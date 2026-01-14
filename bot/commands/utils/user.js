const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Comandos de usuario')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Muestra información detallada de un usuario')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('El usuario a consultar (opcional)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('discord_id')
                        .setDescription('ID de Discord manual (si el usuario no está en el servidor)')
                        .setRequired(false))),

    async execute(interaction, client, supabase) {
        try {
            console.log('[UserInfo] Starting execution...');
            // Deferral is handled globally in index_unified.js

            const targetOption = interaction.options.getUser('target');
            const idOption = interaction.options.getString('discord_id');

            let targetUser = targetOption || interaction.user;
            let targetId = targetUser.id;

            // Override if ID provided manual
            if (idOption) {
                targetId = idOption.trim();
                try {
                    console.log(`[UserInfo] Fetching manual ID: ${targetId}`);
                    targetUser = await client.users.fetch(targetId);
                } catch (e) {
                    console.error('[UserInfo] Failed to fetch user by ID:', e.message);
                    return interaction.editReply(`❌ No se pudo encontrar un usuario con el ID: ${targetId}`);
                }
            }

            console.log(`[UserInfo] Target Resolved: ${targetUser.tag} (${targetId})`);

            // Check member (might be null if ID provided and not in guild)
            const member = await interaction.guild.members.fetch(targetId).catch(err => {
                console.log('[UserInfo] Member fetch failed (user likely left):', err.message);
                return null;
            });
            console.log(`[UserInfo] Member found: ${!!member}`);

            // 1. Basic Info
            const joinDate = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : 'N/A';
            const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`;
            const roles = member
                ? member.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .sort((a, b) => b.position - a.position)
                    .map(role => role.toString())
                    .join(' ')
                : 'N/A';

            // 2. Economy (UnbelievaBoat)
            console.log('[UserInfo] Fetching Economy...');
            let economytext = 'Datos no disponibles';
            if (client.services && client.services.billing && client.services.billing.ubService) {
                try {
                    // FORCE MAIN GUILD ID for Economy (To work even from Staff Server)
                    const economyGuildId = process.env.GUILD_ID || interaction.guildId;
                    console.log(`[UserInfo] Querying UB for User ${targetId} in Guild ${economyGuildId}`);

                    const balance = await client.services.billing.ubService.getUserBalance(economyGuildId, targetId);
                    economytext = `💵 Efectivo: $${balance.cash.toLocaleString()}\n🏦 Banco: $${balance.bank.toLocaleString()}\n💰 Total: $${balance.total.toLocaleString()}`;
                    console.log('[UserInfo] Economy fetched successfully.');
                } catch (err) {
                    // Handle 404 (User has no economy profile yet) -> Show $0
                    if (err.response && err.response.status === 404) {
                        economytext = `💵 Efectivo: $0\n🏦 Banco: $0\n💰 Total: $0`;
                        console.log('[UserInfo] User has no economy profile (404), defaulting to $0.');
                    } else {
                        const errMsg = err.message || 'Error desconocido';
                        console.error('[UserInfo] Error fetching economy:', err);
                        economytext = `⚠️ Error: ${errMsg}`;
                    }
                }
            } else {
                console.warn('[UserInfo] Billing Service unavailable.');
            }

            // 3. Sanctions (Counts)
            console.log('[UserInfo] Fetching Sanctions...');
            let sanctionsText = 'No disponible';
            if (client.services && client.services.sanctions) {
                try {
                    const counts = await client.services.sanctions.getSanctionCounts(targetId);
                    sanctionsText = `📊 Total Activas: **${counts.notificacion + counts.sa + counts.general}**\n` +
                        `📝 Notificaciones: ${counts.notificacion}\n` +
                        `⚠️ Sanciones Admin (SA): ${counts.sa}\n` +
                        `🚫 Reportes Generales: ${counts.general}`;
                    console.log('[UserInfo] Sanctions fetched successfully.');
                } catch (err) {
                    console.error('[UserInfo] Error fetching sanctions:', err.message);
                }
            } else {
                console.warn('[UserInfo] Sanction Service unavailable.');
            }

            // 4. Blacklist Check
            console.log('[UserInfo] Checking Blacklist...');
            let blacklistStatus = '✅ Limpio';
            try {
                // Check DB for active Blacklist sanctions
                const { data: blSanctions, error: blError } = await supabase
                    .from('sanctions')
                    .select('action_type, reason')
                    .eq('discord_user_id', targetId)
                    .ilike('action_type', '%Blacklist%')
                    .eq('status', 'active');

                if (blError) throw blError;

                if (blSanctions && blSanctions.length > 0) {
                    // Format: • Blacklist Moderación: Razón
                    const reasons = blSanctions.map(b => `• **${b.action_type.replace('Blacklist:', '').trim()}**: ${b.reason}`).join('\n');
                    blacklistStatus = `⛔ **USUARIO EN BLACKLIST**\n${reasons}`;
                } else {
                    // Determine if they have any blacklist roles explicitly
                    const BLACKLIST_ROLES = [
                        '1451860028653834300', // Mod
                        '1413714060423200778', // Policial
                        '1449930883762225253', // Cartel
                        '1413714467287470172', // Politica
                        '1413714540834852875', // Empresas
                        '1459240544017453238'  // Influencer
                    ];
                    if (member && member.roles.cache.some(r => BLACKLIST_ROLES.includes(r.id))) {
                        blacklistStatus = `⛔ **TIENE ROLES DE BLACKLIST**`;
                    }
                }
                console.log('[UserInfo] Blacklist checked.');
            } catch (err) {
                console.error('[UserInfo] Error checking blacklist:', err.message);
            }

            // 5. Build Embed
            console.log('[UserInfo] Building Embed...');
            const embed = new EmbedBuilder()
                .setColor(member ? member.displayHexColor : '#0099ff')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .addFields(
                    { name: '🆔 Información Básica', value: `**ID:** ${targetId}\n**Nick:** ${member ? member.displayName : 'N/A'}\n**Bot:** ${targetUser.bot ? 'Sí' : 'No'}`, inline: true },
                    { name: '📅 Fechas', value: `**Creado:** ${createDate}\n**Ingreso:** ${joinDate}`, inline: true },
                    { name: '💼 Economía', value: economytext, inline: false },
                    { name: '🛡️ Historial de Sanciones', value: sanctionsText, inline: true },
                    { name: '⛔ Estado de Blacklist', value: blacklistStatus, inline: true },
                    { name: '🎭 Roles', value: roles.length > 1024 ? `${roles.substring(0, 1020)}...` : (roles || 'Ninguno') }
                )
                .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            console.log('[UserInfo] Reply sent.');

        } catch (fatalError) {
            console.error('[UserInfo] FATAL CRASH:', fatalError);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply('❌ Error interno al procesar el comando (Checar consola).');
            } else {
                await interaction.reply({ content: '❌ Error interno.', ephemeral: true });
            }
        }
    },
};
