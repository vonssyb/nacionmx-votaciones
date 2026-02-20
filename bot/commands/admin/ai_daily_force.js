const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AIDailyService = require('../../services/AIDailyService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai_daily_force')
        .setDescription('ADMIN: Fuerza la generación del Diario del Servidor (AI)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, supabase) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Instantiate service on demand (or use singleton if available)
            // Ensure client.aiService is initialized in main bot file
            if (!client.aiService) {
                return interaction.editReply('❌ El servicio de IA no está inicializado.');
            }

            const dailyService = new AIDailyService(client, supabase);

            // Channel ID hardcoded or from config. For now using the one specified by user.
            const targetChannel = '1398891368398585886';

            await dailyService.generateDailyReport(targetChannel);

            await interaction.editReply(`✅ Reporte diario enviado al canal <#${targetChannel}>.`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Falla al generar el reporte.');
        }
    }
};
