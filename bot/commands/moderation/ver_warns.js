const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ver_warns')
        .setDescription('Ver el historial de sanciones de cualquier usuario (Solo Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuario a consultar')
                .setRequired(true)),

    async execute(interaction) {
        // Defer immediately to prevent timeout on slow systems (e.g. Render spin-up)
        await interaction.deferReply({ flags: [64] });

        // SECURITY CHECK: Specific Role/User ID Check
        const authorizedIds = [
            '1450242487422812251', // Staff Leader / Viewer
            '1456020936229912781'  // The Boss
        ];

        // Allow if user has the authorized ID OR has one of the roles (if these were role IDs)
        // Since prompt says "como staff 14502...", assuming it's a User ID or Role ID.
        // We will check both user ID and role cache.
        const isAuthorized = authorizedIds.includes(interaction.user.id) ||
            interaction.member.roles.cache.has('1450242487422812251') ||
            interaction.member.roles.cache.has('1456020936229912781');

        if (!isAuthorized && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: '🛑 No tienes permiso para ver el historial de otros usuarios.' });
        }

        // Already deferred

        try {
            const targetUser = interaction.options.getUser('usuario');

            if (!interaction.client.services || !interaction.client.services.sanctions) {
                return interaction.editReply('❌ El servicio de sanciones no está disponible.');
            }

            const sanctions = await interaction.client.services.sanctions.getUserSanctions(targetUser.id);
            const counts = await interaction.client.services.sanctions.getSanctionCounts(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor('#FF4500') // OrangeRed
                .setTitle(`📂 Historial de: ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '📊 Resumen Total', value: `Warns: **${counts.general}**\nSAs: **${counts.sa}**\nNotif: **${counts.notificacion}**`, inline: false }
                )
                .setTimestamp();

            if (sanctions && sanctions.length > 0) {
                // Use PaginationHelper to handle long lists
                const PaginationHelper = require('../../utils/PaginationHelper');

                await PaginationHelper.paginate(interaction, sanctions, {
                    itemsPerPage: 5, // Show 5 sanctions per page to avoid length limit
                    formatPage: (pageSanctions, pageNum, totalPages) => {
                        const list = pageSanctions.map(s => {
                            let icon = '📜';
                            let displayType = s.action_type || (s.type === 'general' ? 'Sanción General' : 'Notificación');

                            if (s.type === 'sa') { icon = '🚨'; displayType = 'Sanción Administrativa'; }
                            else if (s.type === 'notificacion') { icon = '📢'; displayType = 'Notificación'; }

                            if (displayType.toLowerCase().includes('blacklist')) icon = '⛔';
                            if (displayType.toLowerCase().includes('ban')) icon = '🔨';

                            const date = new Date(s.created_at).toLocaleDateString('es-MX');
                            const evidenceLink = s.evidence_url ? ` | [📸 Evidencia](${s.evidence_url})` : '';
                            const expiration = s.expires_at ? `\n⏳ Expira: ${new Date(s.expires_at).toLocaleDateString('es-MX')} ${new Date(s.expires_at).toLocaleTimeString('es-MX')}` : '';

                            const descriptionText = s.description ? `\n> *${s.description.substring(0, 200)}*` : ''; // Truncate long descriptions
                            let entry = `🆔 \`${s.id}\`\n**${icon} ${displayType}** | <@${s.moderator_id}> | [${date}]${evidenceLink}\n**Motivo:** ${s.reason.substring(0, 150)}${descriptionText}${expiration}`;

                            if (s.status === 'appealed') {
                                entry = `✨ **[APELADA]** ${entry}`;
                            }
                            return entry;
                        }).join('\n-------------------\n');

                        const embed = new EmbedBuilder()
                            .setColor('#FF4500')
                            .setTitle(`📂 Historial de: ${targetUser.tag}`)
                            .setThumbnail(targetUser.displayAvatarURL())
                            .addFields(
                                { name: '📊 Resumen Total', value: `Warns: **${counts.general}**\nSAs: **${counts.sa}**\nNotif: **${counts.notificacion}**`, inline: false }
                            )
                            .setDescription(list)
                            .setFooter({ text: `Página ${pageNum + 1}/${totalPages} • Total: ${sanctions.length} sanciones` })
                            .setTimestamp();

                        return embed;
                    }
                });

            } else {
                embed.setDescription('✅ El usuario no tiene sanciones activas.');
                embed.setColor('#00FF00');
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al obtener el historial.');
        }
    }
};
