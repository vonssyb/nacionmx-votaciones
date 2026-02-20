const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ia_economia')
        .setDescription('📉 AI Economista: Analiza la inflación y transacciones sospechosas')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('horas')
                .setDescription('Horas hacia atrás a analizar (Default: 24)')
                .setMinValue(1).setMaxValue(72).setRequired(false)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();
        const hours = interaction.options.getInteger('horas') || 24;
        const ai = client.aiService;

        if (!ai || !ai.model) {
            return interaction.editReply('❌ IA no disponible.');
        }

        try {
            // 1. Fetch Economy Data
            const timeAgo = new Date();
            timeAgo.setHours(timeAgo.getHours() - hours);

            const { data: logs, error } = await supabase
                .from('transaction_audit')
                .select('*')
                .gte('created_at', timeAgo.toISOString())
                .order('amount', { ascending: false })
                .limit(50); // Analyze top 50 biggest moves

            if (!logs || logs.length === 0) {
                return interaction.editReply('📉 No hay suficientes datos de transacciones en este periodo.');
            }

            // Summarize for AI
            const summary = logs.map(l =>
                `- [${l.transaction_type}] User <${l.user_id}>: $${Number(l.amount).toLocaleString()}`
            ).join('\n');

            const totalVolume = logs.reduce((acc, l) => acc + Number(l.amount), 0);

            // 2. Prompt AI
            const prompt = `
            Actúa como un Economista Experto para un servidor de GTA Roleplay.
            Analiza los siguientes datos de las últimas ${hours} horas:
            
            Volumen Total Movido (Top 50 txs): $${totalVolume.toLocaleString()}
            
            Lista de Transacciones Grandes:
            ${summary}

            Tu Misión:
            1. Detecta patrones sospechosos (ej. pitufeo, lavado de dinero, duping).
            2. Evalúa la salud de la economía (¿Hay demasiada inyección de dinero?).
            3. Recomendación: ¿Debemos subir impuestos, bajar intereses, o investigar a alguien?

            Sé directo y usa bullet points.
            `;

            const result = await ai.model.generateContent(prompt);
            const report = result.response.text();

            const embed = new EmbedBuilder()
                .setTitle(`📉 Informe Económico (Últimas ${hours}h)`)
                .setDescription(report)
                .setColor('#27AE60')
                .setFooter({ text: 'AI Economist System' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al generar el informe económico.');
        }
    }
};
