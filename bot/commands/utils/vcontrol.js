const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VoiceEmbeds = require('../../utils/voiceEmbeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vcontrol')
        .setDescription('🎛️ Panel de control del canal de voz actual'),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const member = interaction.member;

        // Verificar que el usuario esté en un canal de voz
        if (!member.voice.channelId) {
            return interaction.editReply({
                content: '❌ Debes estar en un canal de voz para usar este comando.'
            });
        }

        const channel = member.voice.channel;

        if (!channel) {
            return interaction.editReply({
                content: '❌ No se pudo obtener información del canal.'
            });
        }

        try {
            // Verificar permisos de moderación
            let isOwner = false;
            let isModerator = false;

            // Verificar si es owner del canal temporal
            if (client.tempChannelManager) {
                isOwner = await client.tempChannelManager.isChannelOwner(channel.id, member.id);
            }

            // Verificar si es moderador
            if (client.voicePermissionManager) {
                const modCheck = await client.voicePermissionManager.canModerateChannel(member, channel.id);
                isModerator = modCheck.allowed;
            } else {
                // Fallback: verificar permisos de Discord
                isModerator = member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                    member.permissions.has(PermissionFlagsBits.MoveMembers);
            }

            // Crear embed del panel de control
            const embed = VoiceEmbeds.createControlPanel(channel, member);
            const components = VoiceEmbeds.createControlComponents(isOwner, isModerator);

            await interaction.editReply({
                embeds: [embed],
                components: components
            });

            console.log(`[VControl Command] ${member.user.tag} abrió el panel de control para ${channel.name}`);
        } catch (error) {
            console.error('[VControl Command] Error:', error);
            await interaction.editReply({
                content: '❌ Error al abrir el panel de control.'
            });
        }
    }
};
