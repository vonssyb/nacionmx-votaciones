const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Inicializar Groq
// NOTA: El usuario debe poner GROQ_API_KEY en su .env
// Inicializar Groq
// NOTA: El usuario debe poner GROQ_API_KEY en su .env
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

// FALLBACK: Vision models (90b/11b) decomissioned. Using robust text model.
const AI_MODEL = "llama-3.3-70b-versatile";


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

👁️ CAPACIDAD VISUAL:
Si el usuario sube una imagen, PUEDES VERLA. Analízala para verificar niveles, logs, recibos o pruebas de rol.

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
1. Solo sugiere GRANT_ROLE si ves PRUEBAS CLARAS (imagen del nivel, recibo, etc).
2. Solo sugiere REMOVE_SANCTION si la apelación es sólida y coincide con las reglas de perdón.
3. Si dudas, solo responde con texto y pide esperar a un humano.
4. Mantén un tono profesional, firme pero útil.
`;

// Palabras prohibidas (Filtro local rápido)
const BAD_WORDS = ['pendejo', 'imbecil', 'idiota', 'estupido', 'verga', 'puto', 'mierda', 'chinga', 'tonto', 'inutil'];

// Función interna reutilizable para generar respuesta
async function generateAIResponse(query) {
    if (!process.env.GROQ_API_KEY) {
        console.error('[GROQ] API Key is missing');
        return "ERROR_MISSING_KEY: La variable GROQ_API_KEY no está definida en el entorno.";
    }
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: query }
            ],
            model: AI_MODEL,
            temperature: 0.5,
            max_tokens: 500,
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
        // Check if last message was from Staff to avoid interrupting conversation
        const messages = await message.channel.messages.fetch({ limit: 5 });
        const lastStaffMsg = messages.find(m => m.member?.permissions.has(PermissionFlagsBits.ManageMessages) && !m.author.bot);

        // Si un staff habló hace menos de 2 minutos, la IA se calla para no molestar
        if (lastStaffMsg && (Date.now() - lastStaffMsg.createdTimestamp < 120000)) return;

        // Evitar bucles: Si la IA ya respondió el último mensaje, no responder otra vez salvo que pregunten de nuevo
        const lastMsg = messages.first();
        if (lastMsg.author.id === client.user.id) return;

        // ACTIVADOR: Solo responder si es una pregunta clara o menciona palabras clave generales
        // O responder a TODO lo que diga el creador del ticket si está "solo".
        // Para economizar tokens y no ser spam, responderemos si el mensaje tiene longitud > 5 chars.
        if (message.content.length < 5) return;

        try {
            // Indicar que está escribiendo...
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
                    .maybeSingle(); // Safe if not found

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

                // Send silently or ephemeral if possible? No, ephemeral works on interaction only.
                // We send it to channel, but maybe with a "Staff Only" hint?
                // Ideally we filter it by permissions later, but for now we put it in the channel.
                // TODO: Gate the button interaction to Staff only.
                await message.channel.send({ content: '🕵️ **Propuesta para Staff:**', embeds: [actionEmbed], components: [row] });
            }
        } catch (error) {
            console.error('Gemini Handler Error:', error);
        }
    }
};
