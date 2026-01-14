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
                        .setRequired(false))),

    async execute(interaction, client, supabase) {
        // Deferral is handled globally in index_unified.js

        const targetUser = interaction.options.getUser('target') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

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
        let economytext = 'Datos no disponibles';
        if (client.services && client.services.billing && client.services.billing.ubService) {
            try {
                const balance = await client.services.billing.ubService.getUserBalance(interaction.guildId, targetUser.id);
                economytext = `💵 Efectivo: $${balance.cash.toLocaleString()}\n🏦 Banco: $${balance.bank.toLocaleString()}\n💰 Total: $${balance.total.toLocaleString()}`;
            } catch (err) {
                console.error('Error fetching economy:', err);
                economytext = '⚠️ Error al obtener saldo (API Timeout)';
            }
        }

        // 3. Sanctions (Counts)
        let sanctionsText = 'No disponible';
        if (client.services && client.services.sanctions) {
            try {
                const counts = await client.services.sanctions.getSanctionCounts(targetUser.id);
                sanctionsText = `📊 Total Activas: **${counts.notificacion + counts.sa + counts.general}**\n` +
                    `📝 Notificaciones: ${counts.notificacion}\n` +
                    `⚠️ Sanciones Admin (SA): ${counts.sa}\n` +
                    `🚫 Reportes Generales: ${counts.general}`;
            } catch (err) {
                console.error('Error fetching sanctions:', err);
            }
        }

        // 4. Blacklist Check
        let blacklistStatus = '✅ Limpio';
        try {
            // Check DB for active Blacklist sanctions
            const { data: blSanctions } = await supabase
                .from('sanctions')
                .select('action_type, reason')
                .eq('discord_user_id', targetUser.id)
                .ilike('action_type', '%Blacklist%')
                .eq('status', 'active');

            if (blSanctions && blSanctions.length > 0) {
                const reasons = blSanctions.map(b => `${b.action_type} (${b.reason})`).join('\n');
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
        } catch (err) {
            console.error('Error checking blacklist:', err);
        }

        // 5. Build Embed
        const embed = new EmbedBuilder()
            .setColor(member ? member.displayHexColor : '#0099ff')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .addFields(
                { name: '🆔 Información Básica', value: `**ID:** ${targetUser.id}\n**Nick:** ${member ? member.displayName : 'N/A'}\n**Bot:** ${targetUser.bot ? 'Sí' : 'No'}`, inline: true },
                { name: '📅 Fechas', value: `**Creado:** ${createDate}\n**Ingreso:** ${joinDate}`, inline: true },
                { name: '💼 Economía', value: economytext, inline: false },
                { name: '🛡️ Historial de Sanciones', value: sanctionsText, inline: true },
                { name: '⛔ Estado de Blacklist', value: blacklistStatus, inline: true },
                { name: '🎭 Roles', value: roles.length > 1024 ? `${roles.substring(0, 1020)}...` : (roles || 'Ninguno') }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
