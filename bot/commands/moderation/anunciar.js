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
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

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

        // 2. INSTANT Channel Discovery (using Channel Members)
        const excludeKeywords = ['Canal de Espera', 'Junta Directiva', 'Staff', 'Soporte'];
        const targetIds = ['1459640433297588401', '1412967056730755143', '1412967017639575562', '1412927576879661207', '1398525215675252872'];

        console.log(`[Anunciar] --- START VOICE DISCOVERY AUDIT ---`);

        const allVoiceChannels = interaction.guild.channels.cache.filter(c => c.isVoiceBased());
        console.log(`[Anunciar] Total Voice Channels Visible: ${allVoiceChannels.size}`);

        const channelsToNotify = [];

        allVoiceChannels.forEach(channel => {
            const humans = channel.members.filter(m => !m.user.bot);
            const isExcluded = excludeKeywords.some(keyword => channel.name.includes(keyword));
            const isTarget = targetIds.includes(channel.id);

            if (isTarget || humans.size > 0) {
                const canView = channel.viewable;
                const canConnect = channel.joinable;
                console.log(`[Anunciar] Audit VC: ${channel.name} (${channel.id}) | Humans: ${humans.size} | Excluded: ${isExcluded} | Viewable: ${canView} | Joinable: ${canConnect}`);

                if (isTarget && humans.size === 0) {
                    console.log(`[Anunciar] ⚠️ Target channel ${channel.name} is EMPTY according to bot cache.`);
                }
                if (isTarget && !canConnect) {
                    console.log(`[Anunciar] ❌ Bot CANNOT CONNECT to target channel ${channel.name}. Check permissions.`);
                }
            }

            if (humans.size > 0 && !isExcluded) {
                console.log(`[Anunciar] ✅ Including: ${channel.name}`);
                channelsToNotify.push(channel.id);
            }
        });

        console.log(`[Anunciar] --- END VOICE DISCOVERY AUDIT (Total: ${channelsToNotify.length}) ---`);

        if (channelsToNotify.length === 0) {
            console.log(`[Anunciar] No valid channels found after filtering.`);
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
