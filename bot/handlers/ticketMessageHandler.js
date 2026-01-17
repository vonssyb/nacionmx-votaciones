const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

// --- CONFIGURACIÓN HÍBRIDA ---
// CEREBRO: Groq (Llama 3.3 70b) - Genera las respuestas de chat.
// OJOS: Gemini (1.5 Flash) - Solo describe las imágenes para Groq.

// 1. Inicializar Groq (Cerebro)
let groq;
try {
    if (process.env.GROQ_API_KEY) {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } else {
        console.warn('⚠️ GROQ_API_KEY no encontrada. La IA de tickets no funcionará.');
    }
} catch (e) {
    console.error('Error inicializando Groq:', e);
}
const AI_MODEL_CHAT = "llama-3.3-70b-versatile";

// 2. Inicializar Gemini (Ojos)
let visionModel = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } catch (e) {
        console.error("Error inicializando Gemini (Visión):", e);
    }
}

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

// --- Helper: Analizar Imagen con Gemini ---
async function getImageDescription(imageUrl) {
    if (!visionModel) return "Error: Sistema de visión (Gemini) no configurado. Falta GEMINI_API_KEY.";

    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imagePart = {
            inlineData: {
                data: Buffer.from(response.data).toString("base64"),
                mimeType: response.headers['content-type'] || "image/png"
            }
        };

        const result = await visionModel.generateContent([
            { text: "Describe esta imagen detalladamente para un moderador de Discord. Menciona nombres de usuario, textos visibles, chats, recibos bancarios o situaciones de rol. Sé objetivo y preciso." },
            imagePart
        ]);
        return result.response.text();
    } catch (err) {
        console.error("Vision Analyze Error:", err.message);
        return "Error analizando la imagen (Fallo técnico).";
    }
}

// Función Principal
async function generateAIResponse(query, imageUrl = null) {
    let visualContext = "";

    // 1. Pre-procesar Imagen (si existe)
    if (imageUrl) {
        if (visionModel) {
            const description = await getImageDescription(imageUrl);
            visualContext = `\n\n[SISTEMA - ANÁLISIS VISUAL]: El usuario adjuntó una imagen. Un módulo de visión la describe así:\n"${description}"\n\n(Usa esta descripción para validar pruebas).`;
            query += visualContext;
        } else {
            query += "\n\n[SISTEMA: El usuario envió una imagen, pero el módulo de visión (Gemini) NO está activo. Avisa que no puedes verla.]";
        }
    }

    if (!process.env.GROQ_API_KEY) {
        console.error('[GROQ] API Key is missing');
        return "ERROR_MISSING_KEY: La variable GROQ_API_KEY no está definida en el entorno.";
    }

    // 2. Generar Respuesta con Groq (Chat)
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: query }
            ],
            model: AI_MODEL_CHAT,
            temperature: 0.5,
            max_tokens: 800,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error('Groq Generate Error:', error);
        return `ERROR_API: ${error.message}`;
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
        const lastStaffMsg = messages.find(m => m.member?.permissions.has(PermissionFlagsBits.ManageMessages) && !m.author.bot);

        if (lastStaffMsg && (Date.now() - lastStaffMsg.createdTimestamp < 120000)) return;
        const lastMsg = messages.first();
        if (lastMsg.author.id === client.user.id) return;

        if (message.content.length < 5) return;

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

            const queryWithContext = `CONTEXTO DEL USUARIO:\n${userContext}\n\nMENSAJE DEL USUARIO:\n${message.content || "(Imagen enviada)"}`;

            const aiResult = await generateAIResponse(queryWithContext, imageUrl);
            const responseText = typeof aiResult === 'object' ? aiResult.content : aiResult;
            const actionRequest = typeof aiResult === 'object' ? aiResult.action : null;

            if (responseText) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 Asistente Virtual')
                    .setDescription(responseText)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Soy una IA. Espera a un humano si mi respuesta no ayuda.' });

                await message.channel.send({ embeds: [embed] });
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
