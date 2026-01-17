const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Contexto del Servidor (System Prompt para la IA)
const SERVER_CONTEXT = `
Eres el Asistente IA de Soporte de "Nación MX", un servidor de Roleplay en ER:LC (Roblox).
Tu trabajo es responder dudas cortas y directas. NO inventes comandos.
Información Real del Servidor:
- IP/Código: Se encuentra en el canal #información.
- Convocatorias: FEC (Viernes), GN (Formulario Discord).
- Facciones Ilegales: Cartel requiere historia de rol aprobada en ticket.
- CK (Character Kill): Requiere aprobación de Staff y pruebas de rol válido.
- PK (Player Kill): Olvidar rol reciente (NLR 15 min).
- Apelaciones: Solo vía ticket opción "Apelación". Mentir es ban.
- Comandos: /recuperar (contraseña), /vincular-roblox (cuenta), /bug (reportar).
- Horario Staff: 10:00 AM - 12:00 AM CDMX.
- Tono: Profesional, serio pero servicial. Respuestas cortas (max 2 lineas).
`;

// Palabras prohibidas (Filtro local rápido)
const BAD_WORDS = ['pendejo', 'imbecil', 'idiota', 'estupido', 'verga', 'puto', 'mierda', 'chinga', 'tonto', 'inutil'];

module.exports = {
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

            const prompt = `Contexto: ${SERVER_CONTEXT}\nUsuario pregunta: "${message.content}"\nRespuesta:`;

            const result = await model.generateContent(prompt);
            const response = result.response.text();

            if (response) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 Asistente Virtual')
                    .setDescription(response)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Soy una IA. Espera a un humano si mi respuesta no ayuda.' });

                await message.channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Gemini Error:', error);
            // Fallback silencioso (no enviamos nada si la IA falla)
        }
    }
};
