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
    console.error('Error cargando contexto IA:', err.message);
}

// Cargar Conocimiento Administrativo
let ADMIN_KNOWLEDGE = '';
try {
    ADMIN_KNOWLEDGE = fs.readFileSync(path.join(__dirname, '../knowledge/admin_guide.md'), 'utf-8');
} catch (err) {
    console.warn('⚠️ admin_guide.md no encontrado, IA tendrá conocimiento limitado de normativa');
}

const SYSTEM_PROMPT = `
Eres un asistente de tickets para Nación MX (servidor ER:LC).

REGLAS ESTRICTAS:
1. Respuestas de 1-2 párrafos MAX
2. USA SOLO datos reales que te den
3. NO inventes JSON de acciones genéricos
4. Sé directo y conciso

CONOCIMIENTO:
${SERVER_CONTEXT}
${ADMIN_KNOWLEDGE}

CONSULTA DE SANCIONES:
- Lista las sanciones REALES del contexto
- Busca por palabra clave si piden una específica
- Responde: "Encontré [N]: [lista breve]"

CUANDO STAFF SOLICITA APROBAR UNA ACCIÓN:
Si staff pide explícitamente proceder con una acción (devolver dinero, quitar sanción, dar rol), 
responde brevemente Y agrega al FINAL:

---
ACCIÓN_PROPUESTA
tipo: [refund_money|remove_sanction|grant_role]
usuario: [user_id o @mention]
datos: [monto|sanction_id|role_name]
razon: [explicación breve]
---

NUNCA propongas acciones sin que staff lo solicite explícitamente.
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

        // Solo en canales de tickets, NO en canales administrativos
        const EXCLUDED_CHANNELS = [
            '1398891368398585886', // Altos Mandos
        ];

        if (EXCLUDED_CHANNELS.includes(message.channel.id)) return;

        // VERIFICAR SI ES UN TICKET REAL EN LA BASE DE DATOS
        const { data: ticketCheck } = await supabase
            .from('tickets')
            .select('channel_id')
            .eq('channel_id', message.channel.id)
            .maybeSingle();

        // Si NO es un ticket registrado, ignorar (a menos que sea @mención)
        if (!ticketCheck && !message.mentions.has(client.user)) {
            return;
        }

        // SEGURIDAD: Solo el dueño del ticket puede hablar con la IA automáticamente
        try {
            const { data: ticket } = await supabase
                .from('tickets')
                .select('user_id')
                .eq('channel_id', message.channel.id)
                .maybeSingle();

            // Detectar si es staff
            const staffRoles = ['1412887167654690908', '1398526164253888640', '1412882245735420006']; // ROLE_COMMON, ROLE_ADMIN, Junta Directiva
            const isStaff = message.member?.roles.cache.some(r => staffRoles.includes(r.id));
            const botMentioned = message.mentions.has(client.user);

            // Si es staff y NO menciona al bot, ignorar
            if (isStaff && !botMentioned) {
                return; // Staff no activa bot a menos que lo mencione
            }

            // Si NO es staff y NO es el dueño del ticket, ignorar
            if (!isStaff && ticket && ticket.user_id !== message.author.id) {
                return; // Solo el dueño del ticket puede usar la IA
            }
        } catch (err) {
            console.error('Error verificando dueño del ticket:', err);
        }

        // Si el staff fue llamado, el bot se silencia permanentemente
        // Solo responde si es mencionado (@bot)
        const state = ticketStates.get(message.channel.id) || {};
        const botMentioned = message.mentions.has(client.user);

        if (state.staffCalled && !botMentioned) {
            return; // Bot silenciado, solo responde con @mención
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
            // 0. CONTEXTO MASIVO: Obtener historial extendido (50 mensajes)
            const messageHistory = await message.channel.messages.fetch({ limit: 50 });
            const conversationContext = messageHistory
                .reverse()
                .map(m => `[${m.author.tag}]: ${m.content || '(imagen)'}`.substring(0, 200))
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

            // 2. Fetch Sanctions (del usuario mencionado O del autor)
            if (client.services && client.services.sanctions) {
                try {
                    // Si staff menciona a otro usuario, consultar ese usuario
                    let targetUserId = message.author.id;
                    const mentionedUser = message.mentions.users.filter(u => !u.bot).first();
                    if (mentionedUser && isStaff) {
                        targetUserId = mentionedUser.id;
                        userContext += `👤 CONSULTANDO USUARIO: ${mentionedUser.tag} (<@${mentionedUser.id}>)\n`;
                    }

                    const sanctions = await client.services.sanctions.getUserSanctions(targetUserId);
                    if (sanctions && sanctions.length > 0) {
                        const history = sanctions.slice(0, 10).map((s, idx) =>
                            `${idx + 1}. [${new Date(s.created_at).toLocaleDateString()}] **${s.type.toUpperCase()}** - ID: ${s.id}\n   Razón: ${s.reason}\n   Estado: ${s.status} | Staff: ${s.staff_name || 'N/A'}`
                        ).join('\n');
                        userContext += `\n📜 HISTORIAL DE SANCIONES (${sanctions.length} total, mostrando últimas 10):\n${history}\n`;
                    } else {
                        userContext += `\n📜 HISTORIAL: Limpio (Sin sanciones).\ n`;
                    }
                } catch (err) {
                    console.error("Error fetching sanctions for AI context:", err);
                }
            } else {
                userContext += `\n(⚠️ No se pudo acceder a la base de datos de sanciones)\n`;
            }

            // 4. TICKETS PREVIOS del usuario
            let ticketHistory = '';
            try {
                const { data: previousTickets } = await supabase
                    .from('tickets')
                    .select('category, created_at, closed_at')
                    .eq('user_id', message.author.id)
                    .neq('channel_id', message.channel.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (previousTickets && previousTickets.length > 0) {
                    ticketHistory = previousTickets.map(t =>
                        `- [${new Date(t.created_at).toLocaleDateString()}] ${t.category}${t.closed_at ? ' (Cerrado)' : ''}`
                    ).join('\n');
                    userContext += `\n📜 TICKETS ANTERIORES:\n${ticketHistory}\n`;
                } else {
                    userContext += `\n📜 TICKETS ANTERIORES: Primera vez abriendo ticket.\n`;
                }
            } catch (err) {
                console.error("Error fetching ticket history:", err);
            }

            // 5. ACTIVIDAD DEL SERVIDOR (logs recientes si existen)
            let serverActivity = '';
            try {
                const { data: recentLogs } = await supabase
                    .from('mod_logs')
                    .select('action, reason, created_at')
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (recentLogs && recentLogs.length > 0) {
                    serverActivity = recentLogs.slice(0, 5).map(log =>
                        `- [${new Date(log.created_at).toLocaleDateString()}] ${log.action}: ${log.reason?.substring(0, 50)}`
                    ).join('\n');
                }
            } catch (err) {
                // Tabla puede no existir, ignorar silenciosamente
            }

            const queryWithContext = `
🌐 CONTEXTO COMPLETO DEL SERVIDOR:
${serverActivity ? `🚨 ACTIVIDAD RECIENTE DEL SERVIDOR:\n${serverActivity}\n\n` : ''}
📋 TEMA DEL TICKET:
${ticketTopic}

💬 CONVERSACIÓN COMPLETA (50 mensajes):
${conversationContext}

👤 PERFIL COMPLETO DEL USUARIO:
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

                // PARSER DE ACCIONES PROPUESTAS
                let actionRow = null;
                const actionMatch = responseText.match(/---\s*ACCIÓN_PROPUESTA\s+tipo:\s*(\w+)\s+usuario:\s*(.+?)\s+datos:\s*(.+?)\s+razon:\s*(.+?)\s+---/is);

                if (actionMatch) {
                    const [_, actionType, userId, actionData, reason] = actionMatch;

                    // Crear botón de aprobación basado en tipo de acción
                    const actionLabels = {
                        refund_money: '💰 Aprobar Devolución',
                        remove_sanction: '✅ Aprobar Quitar Sanción',
                        grant_role: '👑 Aprobar Dar Rol'
                    };

                    const actionButton = new ButtonBuilder()
                        .setCustomId(`approve_action:${actionType}:${userId.trim()}:${actionData.trim()}:${encodeURIComponent(reason.trim())}`)
                        .setLabel(actionLabels[actionType] || '✅ Aprobar Acción')
                        .setStyle(ButtonStyle.Success);

                    actionRow = new ActionRowBuilder().addComponents(actionButton);

                    // Limpiar la respuesta para no mostrar el formato interno
                    embed.setDescription(responseText.replace(/---\s*ACCIÓN_PROPUESTA[\s\S]*?---/gi, '').trim());
                }

                await message.channel.send({
                    embeds: [embed],
                    components: actionRow ? [actionRow, row] : [row]
                });

                // Auto-escalamiento con recopilación de información
                if (needsStaff) {
                    const state = ticketStates.get(message.channel.id) || {};

                    // MARCAR COMO SILENCIADO INMEDIATAMENTE
                    if (!state.staffCalled) {
                        ticketStates.set(message.channel.id, { staffCalled: true });
                    }

                    // Si NO hemos pedido info aún, pedirla primero
                    if (!state.infoRequested) {
                        ticketStates.set(message.channel.id, { staffCalled: true, infoRequested: true });

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

                    // Si YA pedimos info, notificar al staff
                    if (state.infoRequested) {

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
