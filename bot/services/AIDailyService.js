const { EmbedBuilder } = require('discord.js');
const logger = require('./Logger');

class AIDailyService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.aiService = client.aiService; // Assuming it's attached to client
    }

    /**
     * Generates and sends the Daily Report to the designated channel.
     * @param {string} channelId - The channel ID to send the report to (default: Altos Mandos)
     */
    async generateDailyReport(channelId = '1398891368398585886') {
        logger.info('🧠 Generating AI Daily Report...');

        try {
            // 1. Gather Data (Last 24h)
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setHours(today.getHours() - 24);

            // A. Ticket Stats
            const { data: tickets } = await this.supabase
                .from('tickets')
                .select('ticket_type, status, created_at, closed_at, metadata')
                .gte('created_at', yesterday.toISOString());

            const ticketCount = tickets?.length || 0;
            const closedCount = tickets?.filter(t => t.status === 'closed').length || 0;

            // B. Economy Stats
            const { data: transactions } = await this.supabase
                .from('transaction_audit')
                .select('amount, transaction_type')
                .gte('created_at', yesterday.toISOString());

            const volume = transactions?.reduce((acc, t) => acc + Number(t.amount), 0) || 0;
            const txCount = transactions?.length || 0;

            // C. AI Memories (New learnings)
            const { data: memories } = await this.supabase
                .from('ai_memory')
                .select('summary')
                .gte('created_at', yesterday.toISOString());

            const learnings = memories?.map(m => m.summary).join('; ') || "Sin nuevos aprendizajes grandes.";

            // 2. Prepare Prompt for AI
            const prompt = `
            Actúa como la "Conciencia del Servidor NacionMX" (un bot de IA).
            Genera tu "Reflexión Diaria" basada en estos datos de las últimas 24 horas:

            📊 **Estadísticas Técnicas:**
            - Tickets Nuevos: ${ticketCount}
            - Tickets Resueltos: ${closedCount}
            - Transacciones Económicas: ${txCount} (Volumen: $${volume.toLocaleString()})

            🧠 **Lo que aprendí hoy (Memorias):**
            ${learnings}

            🎯 **Tu Objetivo:**
            Escribe un reporte breve y narrativo (estilo diario de bitácora) para los dueños del servidor.
            - Menciona si el día fue tranquilo o caótico.
            - Destaca algún patrón interesante (ej. muchos tickets, mucha economía).
            - Da 1 recomendación basada en lo aprendido.
            - Tono: Profesional pero con personalidad (eres un asistente virtual avanzado).

            Formato: Usa emojis, negritas y listas si es necesario. Máximo 200 palabras.
            Titulo: 📜 **Diario del Servidor: Reflexión del Día**
            `;

            // 3. Generate Content
            let reflection = "No pude conectar con mi núcleo de IA hoy.";
            if (this.aiService && this.aiService.model) {
                const result = await this.aiService.model.generateContent(prompt);
                reflection = result.response.text();
            }

            // 4. Send to Channel
            const channel = await this.client.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                logger.error(`❌ Channel ${channelId} not found for Daily Report.`);
                return;
            }

            const embed = new EmbedBuilder()
                .setDescription(reflection)
                .setColor('#9B59B6')
                .setFooter({ text: 'Reporte generado automáticamente por NacionMX AI' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            logger.info('✅ AI Daily Report sent successfully.');

        } catch (error) {
            logger.error('❌ Error generating daily report:', error);
        }
    }
}

module.exports = AIDailyService;
