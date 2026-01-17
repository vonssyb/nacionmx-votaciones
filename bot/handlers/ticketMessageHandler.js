const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Cargar Contexto desde Archivo
let SERVER_CONTEXT = '';
try {
    const contextPath = path.join(__dirname, '../data/server_knowledge.md');
    // Leer síncrono al inicio para asegurar que esté listo
    if (fs.existsSync(contextPath)) {
        SERVER_CONTEXT = fs.readFileSync(contextPath, 'utf-8');
    } else {
        console.warn('⚠️ No se encontró server_knowledge.md, usando contexto vacío.');
    }
} catch (err) {
    console.error('Error cargando contexto IA:', err);
}

// System Prompt Base
const SYSTEM_PROMPT = `
Eres el Asistente IA de Soporte de "Nación MX" (Roleplay ER:LC en Roblox).
Responde dudas basándote EXCLUSIVAMENTE en el siguiente documento de reglas y leyes.
Si la respuesta no está en el texto, di "No tengo esa información, espera a un humano."
Sé breve, profesional y directo.

DOCUMENTO DE CONOCIMIENTO:
${SERVER_CONTEXT}
`;

// Palabras prohibidas (Filtro local rápido)
const BAD_WORDS = ['pendejo', 'imbecil', 'idiota', 'estupido', 'verga', 'puto', 'mierda', 'chinga', 'tonto', 'inutil'];

// Función interna reutilizable para generar respuesta
async function generateAIResponse(query) {
    if (!process.env.GEMINI_API_KEY) {
        console.error('[GEMINI] API Key is missing');
        return "ERROR_MISSING_KEY: La variable GEMINI_API_KEY no está definida en el entorno.";
    }
    try {
        const fullPrompt = `${SYSTEM_PROMPT}\nUsuario pregunta: "${query}"\nRespuesta:`;
        const result = await model.generateContent(fullPrompt);
        return result.response.text();
    } catch (error) {
        console.error('Gemini Generate Error:', error);
        return `ERROR_API: ${error.message}`; // Fallback con info
    }
}

module.exports = {
    generateAIResponse,
    async handleTicketMessage(message, client, supabase) {
        if (message.author.bot) return;
        if (message.channel.type !== 0) return;

        // Solo en canales de tickets
        if (!message.channel.name.includes('-') && !message.channel.topic?.includes('Ticket')) return;

        // 1. AUTO-BAN (Filtro de Groserías)
        const contentLower = message.content.toLowerCase();
        if (BAD_WORDS.some(w => contentLower.includes(w))) {
            if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return; // Ignorar Staff
            await message.delete().catch(() => { });
            return message.channel.send(`⚠️ <@${message.author.id}>, modera tu lenguaje.`);
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
