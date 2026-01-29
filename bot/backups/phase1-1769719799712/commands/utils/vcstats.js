const { SlashCommandBuilder } = require('discord.js');
const VoiceEmbeds = require('../../utils/voiceEmbeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vcstats')
        .setDescription('📊 Ver estadísticas de actividad de voz')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('👤 Usuario para ver estadísticas (deja vacío para ver las tuyas)')
                .setRequired(false)),

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild.members.cache.get(targetUser.id);

        if (!member) {
            return interaction.editReply({
                content: '❌ No se pudo encontrar al usuario especificado.'
            });
        }

        // Verificar que existe el voiceActivityHandler
        if (!client.voiceActivityHandler) {
            console.error('[VCStats Command] voiceActivityHandler no está disponible');
            return interaction.editReply({
                content: '❌ El sistema de estadísticas no está disponible actualmente.'
            });
        }

        try {
            // Obtener estadísticas del usuario
            const stats = await client.voiceActivityHandler.getUserStats(targetUser.id);

            if (!stats || stats.total_sessions === 0) {
                return interaction.editReply({
                    content: `📊 **${targetUser.username}** aún no tiene actividad de voz registrada.`
                });
            }

            // Crear embed con estadísticas
            const embed = VoiceEmbeds.createStatsEmbed(targetUser, stats);

            await interaction.editReply({
                embeds: [embed]
            });

            console.log(`[VCStats Command] ${interaction.user.tag} consultó estadísticas de ${targetUser.tag}`);
        } catch (error) {
            console.error('[VCStats Command] Error:', error);
            await interaction.editReply({
                content: '❌ Error al obtener estadísticas de voz.'
            });
        }
    }
};
