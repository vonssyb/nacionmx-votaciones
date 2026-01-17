const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// SISTEMA DE ROTACIÓN: 4 API Keys de Groq (400K tokens/día total)
// Version: 5.0 - Groq Multi-Key Rotation System

// Configurar todas las API keys disponibles
const GROQ_KEYS = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4
].filter(Boolean); // Eliminar undefined

let currentKeyIndex = 0;
let groqClient = null;

function initializeGroq() {
    if (GROQ_KEYS.length === 0) {
        console.warn('⚠️ No hay API keys de Groq configuradas');
        return null;
    }
    const key = GROQ_KEYS[currentKeyIndex];
    console.log(`✅ Groq inicializado con API Key #${currentKeyIndex + 1}/${GROQ_KEYS.length}`);
    return new Groq({ apiKey: key });
}

function rotateGroqKey() {
    if (GROQ_KEYS.length <= 1) return false; // No hay más keys

    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
    groqClient = initializeGroq();
    console.log(`🔄 Rotando a Groq API Key #${currentKeyIndex + 1}`);
    return true;
}

groqClient = initializeGroq();
const AI_MODEL_CHAT = "llama-3.3-70b-versatile";

// Sistema de estados para escalamiento a staff
const ticketStates = new Map(); // channelId -> { awaitingInfo: bool, staffCalled: bool }

// Cargar Contexto desde Archivo
let SERVER_CONTEXT = '';
try {
    const contextPath = path.join(__dirname, '../data/server_knowledge.md');
    if (fs.existsSync(contextPath)) {
        SERVER_CONTEXT = fs.readFileSync(contextPath, 'utf-8');
    } else {
        console.warn('⚠️ No se encontró server_knowledge.md, usando contexto vacío.');
    }
} catch (err) {
    console.error('Error cargando contexto IA:', err);
}

// --- CARGAR CONOCIMIENTO DEL SERVIDOR ---
let SERVER_KNOWLEDGE = "";
try {
    const knowledgePath = path.join(__dirname, '../data/server_knowledge.md');
    if (fs.existsSync(knowledgePath)) {
        SERVER_KNOWLEDGE = fs.readFileSync(knowledgePath, 'utf-8');
    }
} catch (e) {
    console.error("Error cargando server_knowledge.md", e);
}

const SYSTEM_PROMPT = `
Eres el "Oficial IA" de Nación MX (Roleplay ER:LC).
Tu trabajo es asistir a los usuarios y, cuando sea seguro, PREPARAR acciones para el Staff.

🧠 CONOCIMIENTO Y PROTOCOLOS:
${SERVER_KNOWLEDGE}

CONTEXTO TÉCNICO:
${SERVER_CONTEXT}

👁️ CAPACIDAD VISUAL (Sistema Híbrido):
Si el usuario envía una imagen, recibirás una DESCRIPCIÓN DETALLADA generada por un módulo de visión externo.
Debes confiar en esa descripción como si estuvieras viendo la imagen tú mismo.
Úsala para verificar niveles, logs, recibos o pruebas de rol.

⚡ PROTOCOLO DE ACCIONES (JSON):
Si determinas que se debe realizar una acción (dar rol, quitar sanción), NO LO HAGAS TÚ.
En su lugar, TERMINA tu respuesta con un bloque JSON estricto con este formato:

\`\`\`json
{
  "action": "GRANT_ROLE" | "REMOVE_SANCTION",
  "reason": "Explicación breve para el Staff",
  "data": {
    "role_name": "Nombre exacto del rol",
    "user_id": "ID del usuario (si lo tienes)"
  }
}
\`\`\`

REGLAS DE ACTUACIÓN:
1. Solo sugiere GRANT_ROLE si ves PRUEBAS CLARAS (en la descripción visual de la imagen o texto).
2. Solo sugiere REMOVE_SANCTION si la apelación es sólida.
3. Si dudas, solo responde con texto y pide esperar a un humano.
4. Mantén un tono profesional, firme pero útil.
`;

// Palabras prohibidas (Filtro local rápido)
const BAD_WORDS = ['pendejo', 'imbecil', 'idiota', 'estupido', 'verga', 'puto', 'mierda', 'chinga', 'tonto', 'inutil'];

// --- Helper: Analizar Imagen con Hugging Face BLIP (Gratis, lento) ---
async function getImageDescription(imageUrl) {
    try {
        console.log('🔍 Analizando imagen con Hugging Face BLIP (puede tardar 20-30 seg)...');

        // Descargar imagen
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        // Llamar a Hugging Face Inference API (público, sin auth)
        const hfResponse = await axios.post(
            'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
            imageBuffer,
            {
                headers: { 'Content-Type': 'application/octet-stream' },
                timeout: 60000
            }
        );

        const description = hfResponse.data[0]?.generated_text || "No se pudo generar descripción";
        console.log('✅ Hugging Face análisis completo:', description);

        return `[Descripción básica]: ${description}. NOTA: Para detalles específicos de ER:LC (nombres, niveles, chat exacto), descríbelos tú.`;

    } catch (err) {
        console.error("❌ Hugging Face Error:", err.message);

        if (err.response?.status === 503) {
            return "⏳ Modelo cargándose (~30 seg). Reenvía la imagen en 30 segundos.";
        }

        return "⚠️ Error analizando imagen. Describe qué contiene la captura.";
    }
}


// Función Principal
async function generateAIResponse(query, imageUrl = null) {
    let visualContext = "";


    // 1. Pre-procesar Imagen con Hugging Face (si existe)
    if (imageUrl) {
        const description = await getImageDescription(imageUrl);
        visualContext = `\n\n[SISTEMA - ANÁLISIS VISUAL]: El usuario adjuntó una imagen. Hugging Face BLIP la describe así:\n"${description}"\n\n(Usa esta descripción como referencia).`;
        query += visualContext;
    }

    if (!groqClient || GROQ_KEYS.length === 0) {
        console.error('[GROQ] No hay API keys configuradas');
        return "ERROR_MISSING_KEY: No hay API keys de Groq configuradas.";
    }

    // 2. Generar Respuesta con Groq (con rotación automática)
    let attempts = 0;
    const maxAttempts = GROQ_KEYS.length;

    while (attempts < maxAttempts) {
        try {
            const chatCompletion = await groqClient.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: query }
                ],
                model: AI_MODEL_CHAT,
                temperature: 0.5,
                max_tokens: 800,
            });

            return chatCompletion.choices[0]?.message?.content || "";

        } catch (err) {
            console.error(`Groq Error (Key #${currentKeyIndex + 1}):`, err.message);

            // Si es rate limit (429), rotar a la siguiente key
            if (err.status === 429 && rotateGroqKey()) {
                attempts++;
                console.log(`🔄 Intentando con siguiente API key (${attempts}/${maxAttempts})...`);
                continue;
            }

            // Si no se puede rotar o es otro error, fallar
            return `ERROR_API: ${err.message}`;
        }
    }

    return "⚠️ Todas las API keys de Groq alcanzaron el límite. Vuelve en unas horas.";
}

module.exports = {
    generateAIResponse,
    async handleTicketMessage(message, client, supabase) {
        if (message.author.bot) return;
        if (message.channel.type !== 0) return;

        // Solo en canales de tickets
        if (!message.channel.name.includes('-') && !message.channel.topic?.includes('Ticket')) return;

        // Si el staff fue llamado, el bot se silencia hasta que staff responda
        const state = ticketStates.get(message.channel.id) || {};
        if (state.staffCalled) {
            // Si el mensaje es de staff, resetear el estado
            const staffRoles = ['1412887167654690908', '1398526164253888640']; // ROLE_COMMON y ROLE_ADMIN
            const isStaff = message.member?.roles.cache.some(r => staffRoles.includes(r.id));

            if (isStaff) {
                ticketStates.delete(message.channel.id); // Resetear estado
                console.log(`✅ Staff respondió en ${message.channel.id}, bot reactivado`);
            }
            return; // Bot silenciado hasta que staff responda
        }

        // 1. AUTO-MOD (Shadow Moderation)
        const contentLower = message.content.toLowerCase();
        if (BAD_WORDS.some(w => contentLower.includes(w))) {
            if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return; // Ignorar Staff

            await message.delete().catch(() => { });
            const warningMsg = await message.channel.send(`⚠️ <@${message.author.id}>, mantén el respeto en el ticket o serás sancionado.`);
            setTimeout(() => warningMsg.delete().catch(() => { }), 5000);
            return;
        }

        // 2. IA RESPONSES (Solo si no es Staff y nadie ha respondido recientemente)
        const messages = await message.channel.messages.fetch({ limit: 5 });
        const lastStaffMsg = messages.find(m => m.member?.permissions.has(PermissionFlagsBits.ManageMessages) && !m.author.bot && m.author.id !== message.author.id);

        if (lastStaffMsg && (Date.now() - lastStaffMsg.createdTimestamp < 120000)) return;


        if (message.content.length < 2 && message.attachments.size === 0) return;

        try {
            await message.channel.sendTyping();

            // Vision Checking
            let imageUrl = null;
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('image/')) {
                    imageUrl = attachment.url;
                }
            }


            // --- CONVERSATIONAL MEMORY ---
            // Leer últimos 10 mensajes para contexto de la conversación
            const ticketHistory = await message.channel.messages.fetch({ limit: 10 });
            const conversationContext = ticketHistory
                .reverse()
                .map(m => {
                    const author = m.author.bot ? '🤖 IA' : m.author.username;
                    const content = m.content || '(imagen adjunta)';
                    return `[${author}]: ${content}`;
                })
                .join('\n');

            // Tema original del ticket (contexto principal)
            const ticketTopic = message.channel.topic || 'Ticket sin tema especificado';

            // --- USER CONTEXT (Sanctions & Info) ---
            let userContext = `Usuario: <@${message.author.id}> (${message.author.username})\n`;

            // 1. Fetch Identity (Citizens)
            try {
                const { data: citizen } = await supabase
                    .from('citizens')
                    .select('full_name, dni')
                    .eq('discord_id', message.author.id)
                    .maybeSingle();

                if (citizen) {
                    userContext += `🆔 IDENTIDAD RP: ${citizen.full_name} | DNI: ${citizen.dni || 'N/A'}\n`;
                } else {
                    userContext += `🆔 IDENTIDAD RP: Sin registrar (No tiene DNI)\n`;
                }
            } catch (err) {
                console.error("Error fetching citizen:", err);
            }

            // 2. Fetch Sanctions
            if (client.services && client.services.sanctions) {
                try {
                    const sanctions = await client.services.sanctions.getUserSanctions(message.author.id);
                    if (sanctions && sanctions.length > 0) {
                        const history = sanctions.slice(0, 5).map(s =>
                            `- [${new Date(s.created_at).toLocaleDateString()}] ${s.type.toUpperCase()}: ${s.reason} (${s.status})`
                        ).join('\n');
                        userContext += `\n📜 HISTORIAL DE SANCIONES (Últimas 5):\n${history}\n`;
                    } else {
                        userContext += `\n📜 HISTORIAL: Limpio (Sin sanciones activas).\n`;
                    }
                } catch (err) {
                    console.error("Error fetching sanctions for AI context:", err);
                }
            } else {
                userContext += `\n(⚠️ No se pudo acceder a la base de datos de sanciones)\n`;
            }

            const queryWithContext = `
📋 TEMA DEL TICKET:
${ticketTopic}

💬 CONVERSACIÓN PREVIA (últimos 10 mensajes):
${conversationContext}

👤 CONTEXTO DEL USUARIO:
${userContext}

📨 MENSAJE ACTUAL:
${message.content || "(Imagen enviada)"}
`;

            const aiResult = await generateAIResponse(queryWithContext, imageUrl);
            const responseText = typeof aiResult === 'object' ? aiResult.content : aiResult;
            const actionRequest = typeof aiResult === 'object' ? aiResult.action : null;

            if (responseText) {
                // Detectar si la IA necesita ayuda
                const needsStaff = (
                    responseText.toLowerCase().includes('no puedo') ||
                    responseText.toLowerCase().includes('necesitas un humano') ||
                    responseText.toLowerCase().includes('no tengo autoridad') ||
                    responseText.toLowerCase().includes('error analizando')
                );

                const embed = new EmbedBuilder()
                    .setTitle('🤖 Asistente Virtual')
                    .setDescription(responseText)
                    .setColor(needsStaff ? 0xFF6B6B : 0x5865F2)
                    .setFooter({ text: 'Soy una IA. Espera a un humano si mi respuesta no ayuda.' });

                // Botón manual "Necesito Staff"
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('escalate_to_staff')
                        .setLabel('🚨 Necesito Staff Real')
                        .setStyle(ButtonStyle.Secondary)
                );

                await message.channel.send({ embeds: [embed], components: [row] });

                // Auto-escalamiento con recopilación de información
                if (needsStaff) {
                    const state = ticketStates.get(message.channel.id) || {};

                    // Si NO hemos pedido info aún, pedirla primero
                    if (!state.awaitingInfo && !state.staffCalled) {
                        ticketStates.set(message.channel.id, { awaitingInfo: true, staffCalled: false });

                        const infoEmbed = new EmbedBuilder()
                            .setTitle('📋 Antes de llamar al staff...')
                            .setDescription(`Para ayudarte mejor, por favor proporciona:

1️⃣ **Descripción detallada** de tu problema
2️⃣ **Capturas de pantalla** (si aplica)
3️⃣ **Nombres de usuarios involucrados** (si aplica)
4️⃣ **Cuándo ocurrió** (fecha/hora aproximada)

Responde con toda esta información en tu siguiente mensaje.`)
                            .setColor(0xFFA500)
                            .setFooter({ text: 'El staff será notificado cuando termines de dar la info.' });

                        await message.channel.send({ embeds: [infoEmbed] });
                        return; // No llamar al staff todavía
                    }

                    // Si YA pedimos info y el usuario respondió, ahora sí llamamos al staff
                    if (state.awaitingInfo && !state.staffCalled) {
                        ticketStates.set(message.channel.id, { awaitingInfo: false, staffCalled: true });

                        const STAFF_ROLE_ID = '1412887167654690908';

                        // Compilar resumen para el staff
                        const summaryEmbed = new EmbedBuilder()
                            .setTitle('🚨 Escalamiento a Staff')
                            .setDescription(`**Usuario:** ${message.author}
**Canal:** ${message.channel}

**Información recopilada:**
${message.content}

**Contexto del ticket:**
${ticketTopic}

**Últimos mensajes:**
${conversationContext.substring(0, 500)}...`)
                            .setColor(0xFF0000)
                            .setFooter({ text: 'El bot se silenciará hasta que el staff responda.' });

                        await message.channel.send({
                            content: `🚨 <@&${STAFF_ROLE_ID}>`,
                            embeds: [summaryEmbed]
                        });

                        return; // Bot se silencia después de llamar al staff
                    }
                }
            }

            // --- AI ACTION PROPOSAL (Staff Only) ---
            if (actionRequest) {
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                const actionEmbed = new EmbedBuilder()
                    .setTitle('⚡ Propuesta de Acción (IA)')
                    .setDescription(`La IA sugiere ejecutar: **${actionRequest.action}**\n\n**Razón:** ${actionRequest.reason || 'N/A'}\n**Datos:** \`\`\`json\n${JSON.stringify(actionRequest.data, null, 2)}\n\`\`\``)
                    .setColor(0xFFA500)
                    .setFooter({ text: 'Solo Staff puede confirmar esto.' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ai_confirm_${actionRequest.action}`).setLabel('✅ Confirmar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ai_reject').setLabel('⛔ Rechazar').setStyle(ButtonStyle.Danger)
                );

                await message.channel.send({ content: '🕵️ **Propuesta para Staff:**', embeds: [actionEmbed], components: [row] });
            }
        } catch (error) {
            console.error('Gemini Handler Error:', error);
        }
    }
};
