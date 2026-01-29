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

            // --- FETCHING MEMBER FROM MAIN GUILD ---
            // User requested roles specifically from server: 1398525215134318713
            const MAIN_GUILD_ID = process.env.GUILD_ID || '1398525215134318713';
            let mainMember = null;
            let displayColor = '#0099ff';

            try {
                console.log(`[UserInfo] Fetching member from Main Guild: ${MAIN_GUILD_ID}`);
                const mainGuild = await client.guilds.fetch(MAIN_GUILD_ID);
                mainMember = await mainGuild.members.fetch(targetId).catch(() => null);
                if (mainMember) {
                    displayColor = mainMember.displayHexColor;
                    console.log('[UserInfo] Found member in Main Guild.');
                } else {
                    console.log('[UserInfo] Member NOT found in Main Guild.');
                }
            } catch (gErr) {
                console.error('[UserInfo] Failed to fetch Main Guild:', gErr.message);
            }

            // 1. Basic Info
            // Use mainMember for join date if available, otherwise N/A
            const joinDate = mainMember ? `<t:${Math.floor(mainMember.joinedTimestamp / 1000)}:F> (<t:${Math.floor(mainMember.joinedTimestamp / 1000)}:R>)` : 'No está en el servidor';
            const createDate = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`;

            // Roles list (From Main Guild)
            // Use plain text names because Mentions (<@&ID>) show as "@deleted-role" or "@rol-desconocido" 
            // if viewed from a different server where those roles don't exist.
            const roles = mainMember
                ? mainMember.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .sort((a, b) => b.position - a.position)
                    .map(role => `\`${role.name}\``) // Changed to code block name
                    .join(', ') // Changed to comma separator for cleaner list
                : 'No disponible (Fuera del servidor)';

            // 2. Economy (UnbelievaBoat)
            console.log('[UserInfo] Fetching Economy...');
            let economytext = 'Datos no disponibles';
            if (client.services && client.services.billing && client.services.billing.ubService) {
                try {
                    // FORCE MAIN GUILD ID for Economy
                    console.log(`[UserInfo] Querying UB for User ${targetId} in Guild ${MAIN_GUILD_ID}`);

                    const balance = await client.services.billing.ubService.getUserBalance(MAIN_GUILD_ID, targetId);
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

            // 4. Blacklist Check (DB + Roles)
            console.log('[UserInfo] Checking Blacklist...');
            let blacklistLines = [];

            try {
                // A. Check DB for active Blacklist sanctions
                const { data: blSanctions, error: blError } = await supabase
                    .from('sanctions')
                    .select('action_type, reason')
                    .eq('discord_user_id', targetId)
                    .ilike('action_type', '%Blacklist%')
                    .eq('status', 'active');

                if (blError) throw blError;

                if (blSanctions && blSanctions.length > 0) {
                    blSanctions.forEach(b => {
                        blacklistLines.push(`• **${b.action_type.replace('Blacklist:', '').trim()} (DB)**: ${b.reason}`);
                    });
                }

                // B. Check Roles (Explicitly list ALL matching blacklist roles)
                const BLACKLIST_ROLES = [
                    { id: '1451860028653834300', name: 'Blacklist Mod' },
                    { id: '1413714060423200778', name: 'Blacklist Policial' },
                    { id: '1449930883762225253', name: 'Blacklist Cartel' },
                    { id: '1413714467287470172', name: 'Blacklist Política' },
                    { id: '1413714540834852875', name: 'Blacklist Empresas' },
                    { id: '1459240544017453238', name: 'Blacklist Influencer' }
                ];

                if (mainMember) {
                    const userRoleIds = mainMember.roles.cache.map(r => r.id);
                    BLACKLIST_ROLES.forEach(blRole => {
                        if (userRoleIds.includes(blRole.id)) {
                            // Try to get real role name if possible, fallback to hardcoded name
                            const realRole = mainMember.roles.cache.get(blRole.id);
                            const roleName = realRole ? realRole.name : blRole.name;
                            blacklistLines.push(`• **Rol Detectado**: ${roleName}`);
                        }
                    });
                }
                console.log('[UserInfo] Blacklist checked.');
            } catch (err) {
                console.error('[UserInfo] Error checking blacklist:', err.message);
                blacklistLines.push(`⚠️ Error verificando: ${err.message}`);
            }

            const blacklistStatus = blacklistLines.length > 0
                ? `⛔ **USUARIO EN BLACKLIST**\n${blacklistLines.join('\n')}`
                : '✅ Limpio';

            // 5. Build Embed
            console.log('[UserInfo] Building Embed...');
            const embed = new EmbedBuilder()
                .setColor(displayColor)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
                .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
                .addFields(
                    { name: '🆔 Información Básica', value: `**ID:** ${targetId}\n**Nick:** ${mainMember ? mainMember.displayName : 'N/A'}\n**Bot:** ${targetUser.bot ? 'Sí' : 'No'}`, inline: true },
                    { name: '📅 Fechas', value: `**Creado:** ${createDate}\n**Ingreso:** ${joinDate}`, inline: true },
                    { name: '💼 Economía', value: economytext, inline: false },
                    { name: '🛡️ Historial de Sanciones', value: sanctionsText, inline: true },
                    { name: '⛔ Estado de Blacklist', value: blacklistStatus, inline: true },
                    { name: '🎭 Roles (Servidor Principal)', value: roles.length > 1024 ? `${roles.substring(0, 1020)}...` : (roles || 'Ninguno') }
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
