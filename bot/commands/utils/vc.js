const { SlashCommandBuilder } = require('discord.js');
const voiceConfig = require('../../config/erlcVoiceChannels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vc')
        .setDescription('🎙️ Unirse a un canal de voz mediante un alias')
        .addStringOption(option =>
            option.setName('alias')
                .setDescription('📍 Alias del canal (ej: p1, b1, m1)')
                .setRequired(true)),

    async execute(interaction, client) {
        const abbreviation = interaction.options.getString('alias').toLowerCase();
        const member = interaction.member;

        if (!member.voice.channelId) {
            return interaction.editReply({ content: '❌ Debes estar en un canal de voz para usar este comando.' });
        }

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) {
            return interaction.editReply({ content: `❌ El alias \`${abbreviation}\` no fue encontrado.` });
        }

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        const JUNTA_DIRECTIVA_ROLE = '1412882245735420006';
        const isJD = member.roles.cache.has(JUNTA_DIRECTIVA_ROLE);

        // Required Role Check
        if (channelInfo && channelInfo.requiredRole && !isJD) {
            const roleId = voiceConfig.ROLES[channelInfo.requiredRole];
            if (roleId && !member.roles.cache.has(roleId)) {
                return interaction.editReply({
                    content: `⛔ No tienes permisos para acceder al canal **${channelInfo.name || abbreviation}**.`
                });
            }
        }

        try {
            await member.voice.setChannel(targetId);
            await interaction.editReply({
                content: `✅ Has sido movido a **${channelInfo?.name || abbreviation}**.`
            });
            console.log(`[Slash Command] 🎙️ /vc: ${member.user.tag} moved to ${channelInfo?.name || abbreviation}`);
        } catch (error) {
            console.error(`[Slash Command] /vc Error:`, error.message);
            await interaction.editReply({
                content: `❌ Error al moverte: ${error.message}`
            });
        }
    }
};
