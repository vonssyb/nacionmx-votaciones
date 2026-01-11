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

        // 1. Roblox Announcement (:h) - IMMEDIATE & NON-BLOCKING (with Priority)
        if (erlcService) {
            erlcService.runCommand(`:h ${announcement}`, true).catch(e =>
                console.error('[Anunciar] Non-blocking Roblox error:', e.message)
            );
        }

        await interaction.editReply({ content: `⚡ Iniciando anuncio ultra-rápido en Roblox y canales de voz...` });

        // 2. INSTANT Channel Discovery (using VoiceStates cache)
        const excludeKeywords = ['Canal de Espera', 'Junta Directiva']; // Loosened for debugging

        // DEEP DEBUG: Log every voice state in the cache
        const allStates = interaction.guild.voiceStates.cache;
        console.log(`[Anunciar] Deep Audit: ${allStates.size} total states in cache.`);

        const channelsWithPeople = new Map();
        allStates.forEach(vs => {
            if (!vs.channelId) return;
            const chan = interaction.guild.channels.cache.get(vs.channelId);
            const isBot = vs.member?.user.bot || false;
            const userName = vs.member?.user.tag || `UID:${vs.id}`;

            if (!channelsWithPeople.has(vs.channelId)) {
                channelsWithPeople.set(vs.channelId, { name: chan?.name || 'Unknown', humans: 0, bots: 0 });
            }
            const stats = channelsWithPeople.get(vs.channelId);
            if (isBot) stats.bots++; else stats.humans++;

            console.log(`[Anunciar] VC Audit: User=${userName}, Bot=${isBot}, Channel=${chan?.name || 'Unknown'} (${vs.channelId})`);
        });

        // Unique channels with at least one human
        const activeVoiceChannelIds = [...channelsWithPeople.entries()]
            .filter(([id, stats]) => stats.humans > 0)
            .map(([id, stats]) => id);

        console.log(`[Anunciar] Discovery Summary: Found ${activeVoiceChannelIds.length} unique channels with humans.`);

        // Filter out excluded channels based on their names
        const channelsToNotify = activeVoiceChannelIds.filter(channelId => {
            const stats = channelsWithPeople.get(channelId);
            const isExcluded = excludeKeywords.some(keyword => stats.name.includes(keyword));
            if (isExcluded) {
                console.log(`[Anunciar] Skipping excluded channel: ${stats.name} (${channelId})`);
                return false;
            }
            console.log(`[Anunciar] Including channel: ${stats.name} (${channelId})`);
            return true;
        });

        if (channelsToNotify.length === 0) {
            console.log(`[Anunciar] No valid channels found after filtering.`);
            return await interaction.editReply({
                content: `✅ Roblox actualizado (:h). No hay usuarios en canales de voz públicos para anunciar.`
            });
        }

        console.log(`[Anunciar] Discovery Total: channels=${channelsToNotify.length}`);

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
