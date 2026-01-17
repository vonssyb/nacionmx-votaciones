const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
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

// --- Helper: Analizar Imagen con Gemini 2.0 Flash ---
async function getImageDescription(imageUrl) {
    if (!geminiModel) return "Error: Gemini no configurado. Falta GEMINI_API_KEY.";

    try {
        console.log('🔍 Analizando imagen con Gemini 2.0 Flash...');

        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imagePart = {
            inlineData: {
                data: Buffer.from(response.data).toString("base64"),
                mimeType: response.headers['content-type'] || "image/png"
            }
        };

        const result = await geminiModel.generateContent([
            {
                text: `Analiza esta captura de pantalla de Emergency Response: Liberty County (ER:LC).

IDENTIFICA Y REPORTA:
1. **Nombre del jugador** (esquina superior o UI)
2. **Rango/Nivel/Rol** visible en la pantalla
3. **Chat visible**: Lee EXACTAMENTE lo que dice el chat (palabra por palabra)
4. **Logs del sistema**: Mensajes de kill, spawn, arrestos, etc.
5. **Estadísticas**: Dinero, nivel, experiencia si es visible
6. **Infracciones evidentes**: RDM, VDM, spawn kill, etc.
7. **Contexto visual**: Ubicación, armas, vehículos, situación

SÉ ESPECÍFICO. Cita textos exactos entre comillas. Menciona colores de UI y detalles clave.`
            },
            imagePart
        ]);

        const description = result.response.text();
        console.log('✅ Gemini 2.0 análisis de imagen completo');
        return description;

    } catch (err) {
        console.error("❌ Gemini Vision Error:", err.message);
        return `Error analizando imagen: ${err.message}. Describe verbalmente la captura.`;
    }
}


// Función Principal
async function generateAIResponse(query, imageUrl = null) {
    let visualContext = "";

    // 1. Pre-procesar Imagen (si existe)
    if (imageUrl) {
        if (visionModel) {
            const description = await getImageDescription(imageUrl);
            visualContext = `\n\n[SISTEMA - ANÁLISIS VISUAL]: El usuario adjuntó una imagen. Gemini la describe así:\n"${description}"\n\n(Usa esta descripción para validar pruebas).`;
            query += visualContext;
        } else {
            query += "\n\n[SISTEMA: El usuario envió una imagen, pero el módulo de visión (Gemini) NO está activo. Avisa que no puedes verla.]";
        }
    }

    if (!geminiModel) {
        console.error('[GEMINI] Modelo no inicializado');
        return "ERROR_MISSING_KEY: La variable GEMINI_API_KEY no está definida en el entorno.";
    }

    // 2. Generar Respuesta con Gemini 2.0 Flash
    try {
        const result = await geminiModel.generateContent(query);
        return result.response.text();
    } catch (err) {
        console.error("Gemini Generate Error:", err);

        if (err.message?.includes('quota') || err.message?.includes('limit')) {
            return "⚠️ Límite de Gemini alcanzado. Vuelve en unas horas o describe tu consulta más breve.";
        }

        return `ERROR_API: ${err.message}`;
    }
}

module.exports = {
    generateAIResponse,
    async handleTicketMessage(message, client, supabase) {
        if (message.author.bot) return;
        if (message.channel.type !== 0) return;

        // Solo en canales de tickets
        if (!message.channel.name.includes('-') && !message.channel.topic?.includes('Ticket')) return;

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

                // Auto-escalamiento si la IA detecta que no puede ayudar
                if (needsStaff) {
                    const STAFF_ROLE_ID = '1412887167654690908'; // ROLE_COMMON from config
                    await message.channel.send(`🚨 <@&${STAFF_ROLE_ID}> - **Este ticket requiere soporte humano.** Un moderador debe revisar este caso.`);
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
