const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Inicializar Groq
// NOTA: El usuario debe poner GROQ_API_KEY en su .env
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const AI_MODEL = "llama-3.2-90b-vision-preview"; // Modelo Vision + Chat (Smarter)

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

// System Prompt Avanzado (Agente)
const SYSTEM_PROMPT = `
Eres el "Oficial IA" de Nación MX (Roleplay ER:LC).
Tu trabajo es asistir a los usuarios y, cuando sea seguro, PREPARAR acciones para el Staff.

CONTEXTO DE LEYES Y REGLAS:
${SERVER_CONTEXT}

CAPACIDAD VISUAL:
Si el usuario sube una imagen, PUEDES VERLA. Analízala para verificar niveles, logs, recibos o pruebas de rol.

PROTOCOLO DE ACCIONES (JSON):
Si determinas que se debe realizar una acción (dar rol, quitar sanción), NO LO HAGAS TU.
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

            const response = await generateAIResponse(message.content);

            if (response) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 Asistente Virtual')
                    .setDescription(response)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Soy una IA. Espera a un humano si mi respuesta no ayuda.' });

                await message.channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Gemini Handler Error:', error);
        }
    }
};
