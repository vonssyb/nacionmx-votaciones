const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ia_juez')
        .setDescription('⚖️ AI Comisario: Analiza un crimen y sugiere condena')
        .addStringOption(option =>
            option.setName('crimen')
                .setDescription('Descripción detallada del crimen o atestado')
                .setRequired(true)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();
        const description = interaction.options.getString('crimen');
        const ai = client.aiService;

        if (!ai || !ai.model) {
            return interaction.editReply('❌ IA no disponible.');
        }

        try {
            // Contexto del Código Penal (Simplificado para el prompt)
            const penalCodeContext = `
            Contexto Legal (NacionMX RP):
            - Homicidio: 20-40 meses de prisión + $50,000 multa.
            - Robo a Banco: 15-30 meses + $30,000 multa.
            - Robo a Tienda: 5-10 meses + $5,000 multa.
            - Posesión de Armas Ilegales: 5-15 meses.
            - Exceso de Velocidad: Multa $1,000 - $5,000.
            - Desacato / Huida: +5-10 meses adicionales.
            - Agresión a Oficial: 10-20 meses + $10,000.
            
            Reglas:
            1. Sé imparcial y frío.
            2. Analiza los agravantes (uso de armas, reincidencia implícita, violencia).
            3. Sugiere una condena específica dentro de los rangos.
            `;

            const prompt = `
            ${penalCodeContext}

            Caso a juzgar:
            "${description}"

            Tu tarea:
            1. Clasifica el delito(s).
            2. Dicta una sentencia recomendada.
            3. Justifica brevemente tu decisión basándote en los hechos.

            Formato Salida:
            **Delito Principal:** ...
            **Sentencia Sugerida:** ...
            **Justificación:** ...
            `;

            const result = await ai.model.generateContent(prompt);
            const verdict = result.response.text();

            const embed = new EmbedBuilder()
                .setTitle('⚖️ Veredicto del AI Comisario')
                .setDescription(verdict)
                .setColor('#2C3E50') // Dark Blue/Grey
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/924/924958.png') // Generic Scale Icon
                .setFooter({ text: 'Sugerencia basada en Código Penal v1.0' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al analizar el caso.');
        }
    }
};
