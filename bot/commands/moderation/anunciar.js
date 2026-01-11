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

        const guildId = interaction.guildId;
        const swarmService = client.swarmService || (client.services && client.services.swarm);
        const erlcService = client.services && client.services.erlc;

        if (!swarmService) {
            return interaction.editReply({ content: '❌ El servicio de voz no está disponible.' });
        }
        const announcement = `ANUNCIO DE STAFF: ${message}`;

        // 1. Roblox Announcement (:h) - IMMEDIATE & NON-BLOCKING
        if (erlcService) {
            erlcService.runCommand(`:h ${announcement}`).catch(e =>
                console.error('[Anunciar] Non-blocking Roblox error:', e.message)
            );
        }

        await interaction.editReply({ content: `⚡ Iniciando anuncio ultra-rápido en Roblox y canales de voz...` });

        // 2. INSTANT Channel Discovery (using VoiceStates cache)
        const excludeKeywords = ['Staff', 'Soporte', 'Junta Directiva', 'Canal de Espera'];

        // Find all unique channel IDs where actual humans are currently connected
        const activeVoiceChannelIds = [...new Set(
            interaction.guild.voiceStates.cache
                .filter(vs => vs.channelId && !vs.member?.user.bot)
                .map(vs => vs.channelId)
        )];

        // Filter out excluded channels based on their names
        const channelsToNotify = activeVoiceChannelIds.filter(channelId => {
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) return false;
            return !excludeKeywords.some(keyword => channel.name.includes(keyword));
        });

        if (channelsToNotify.length === 0) {
            return await interaction.editReply({
                content: `✅ Roblox actualizado (:h). No hay usuarios en canales de voz públicos para anunciar.`
            });
        }

        // 3. Parallel Broadcast (Optimized for 8+ drones)
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
            content: `✅ Anuncio emitido: **${successCount}** canales dinámicos y Roblox (:h).`
        });

        console.log(`[Slash Command] 📢 /anunciar by ${member.user.tag}: "${message}"`);
    }
};
