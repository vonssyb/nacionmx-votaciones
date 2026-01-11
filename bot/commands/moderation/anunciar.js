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
        const isStaff = voiceConfig.ROLES.STAFF.some(id => member.roles.cache.has(id));
        const isJD = voiceConfig.ROLES.JUNTA_DIRECTIVA.some(id => member.roles.cache.has(id));

        if (!isStaff && !isJD) {
            return interaction.editReply({ content: '⛔ No tienes permisos para emitir anuncios de staff.' });
        }

        const announcement = `ANUNCIO DE STAFF: ${message}`;
        const guildId = interaction.guildId;
        const swarmService = client.swarmService || (client.services && client.services.swarm);
        const erlcService = client.services && client.services.erlc;

        if (!swarmService) {
            return interaction.editReply({ content: '❌ El servicio de voz no está disponible.' });
        }

        // Get all channels except "espera", staff, support, and jd
        // ALSO: Filter to only include channels with ACTIVE human members
        const excludeKeywords = ['Staff', 'Soporte', 'Junta Directiva', 'Canal de Espera'];
        const channelsToNotify = Object.keys(voiceConfig.CHANNELS).filter(id => {
            const info = voiceConfig.CHANNELS[id];

            // 1. Check exclusions
            const isExcluded = excludeKeywords.some(keyword => info.name.includes(keyword));
            if (isExcluded) return false;

            // 2. Check for active human members
            const channel = interaction.guild.channels.cache.get(id);
            if (!channel || channel.members.size === 0) return false;

            const hasHumans = channel.members.some(member => !member.user.bot);
            return hasHumans;
        });

        if (channelsToNotify.length === 0) {
            // Don't error, just inform that nobody is in voice, but still do Roblox hint
        }

        await interaction.editReply({
            content: `📢 Emitiendo anuncio en ${channelsToNotify.length} canales activos y Roblox (:h)...`
        });

        // Roblox Announcement (:h)
        if (erlcService) {
            try {
                await erlcService.sendCommand(`:h ${announcement}`);
            } catch (e) {
                console.error('[Anunciar] Error sending Roblox announcement:', e.message);
            }
        }

        // Parallel Broadcast (Swarm handles the queuing internally now)
        const broadcastPromises = channelsToNotify.map(channelId =>
            swarmService.speak(guildId, channelId, announcement)
                .then(() => true)
                .catch(err => {
                    console.error(`[Anunciar] Error in channel ${channelId}:`, err.message);
                    return false;
                })
        );

        const results = await Promise.all(broadcastPromises);
        const successCount = results.filter(r => r).length;

        await interaction.editReply({
            content: `✅ Anuncio emitido en **${successCount}** canales de voz y Roblox.`
        });

        console.log(`[Slash Command] 📢 /anunciar by ${member.user.tag}: "${message}"`);
    }
};
