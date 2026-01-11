const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const voiceConfig = require('../../config/erlcVoiceChannels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('📢 Emitir un anuncio de voz en todos los canales (excepto espera)')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('Contenido del anuncio')
                .setRequired(true)),

    async execute(interaction, client) {
        const message = interaction.options.getString('mensaje');
        const member = interaction.member;

        // Permission check: Staff or JD
        const isStaff = member.roles.cache.has(voiceConfig.ROLES.STAFF[0]) || member.roles.cache.has(voiceConfig.ROLES.STAFF[1]);
        const isJD = member.roles.cache.has(voiceConfig.ROLES.JUNTA_DIRECTIVA[0]);

        if (!isStaff && !isJD) {
            return interaction.editReply({ content: '⛔ No tienes permisos para emitir anuncios de staff.' });
        }

        const announcement = `ANUNCIO DE STAFF: ${message}`;
        const guildId = interaction.guildId;
        const swarmService = client.swarmService || (client.services && client.services.swarm);

        if (!swarmService) {
            return interaction.editReply({ content: '❌ El servicio de voz no está disponible.' });
        }

        // Get all channels except "espera"
        const channelsToNotify = Object.keys(voiceConfig.CHANNELS).filter(id => {
            const info = voiceConfig.CHANNELS[id];
            return info.name !== 'Canal de Espera';
        });

        await interaction.editReply({ content: `📢 Emitiendo anuncio en ${channelsToNotify.length} canales...` });

        let successCount = 0;
        for (const channelId of channelsToNotify) {
            try {
                await swarmService.speak(guildId, channelId, announcement);
                successCount++;
            } catch (err) {
                console.error(`[Anunciar] Error in channel ${channelId}:`, err.message);
            }
        }

        await interaction.editReply({
            content: `✅ Anuncio emitido con éxito en **${successCount}** de **${channelsToNotify.length}** canales.`
        });

        console.log(`[Slash Command] 📢 /anunciar by ${member.user.tag}: "${message}"`);
    }
};
