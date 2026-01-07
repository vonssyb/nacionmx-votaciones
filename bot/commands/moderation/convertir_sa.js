const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const NotificationTemplates = require('../../services/NotificationTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('convertir_sa')
        .setDescription('Convierte una Sanción General en Sanción Administrativa (Solo Administración Superior)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('id_sancion')
                .setDescription('ID de la Sanción a convertir')
                .setRequired(true)),

    async execute(interaction) {
        // await interaction.deferReply();

        const ALLOWED_ROLE_ID = '1456020936229912781'; // ID Rol Administración Superior
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.editReply({ content: '🛑 **Acceso Denegado:** Solo la Administración Superior puede ejecutar este comando.' });
        }

        const sanctionId = interaction.options.getString('id_sancion');

        try {
            // 1. Fetch Sanction
            const sanction = await interaction.client.services.sanctions.getSanctionById(sanctionId);

            if (!sanction) {
                return interaction.editReply({ content: '❌ No se encontró ninguna sanción con ese ID.' });
            }

            if (sanction.type === 'sa') {
                return interaction.editReply({ content: '⚠️ Esta sanción ya es una Sanción Administrativa.' });
            }

            if (sanction.type !== 'general') {
                return interaction.editReply({ content: '⚠️ Solo se pueden convertir Sanciones Generales.' });
            }

            // 2. Update Sanction in DB
            const newReason = `${sanction.reason} (Convertido a Sanción SA)`;
            await interaction.client.services.sanctions.updateSanction(sanctionId, {
                type: 'sa',
                reason: newReason
            });

            // 3. Handle Roles & Alerts Logic
            let actionResult = `✅ **Sanción Convertida a SA exitosamente.**`;
            const userId = sanction.discord_user_id;

            if (userId && userId !== 'GLOBAL' && userId !== 'UNKNOWN') {
                const currentSAs = await interaction.client.services.sanctions.getSACount(userId);

                // SA ROLES MAP
                const SA_ROLES = {
                    1: '1450997809234051122',
                    2: '1454636391932756049',
                    3: '1456028699718586459',
                    4: '1456028797638934704',
                    5: '1456028933995630701'
                };

                const member = await interaction.guild.members.fetch(userId).catch(() => null);

                if (member) {
                    try {
                        const allSaRoles = Object.values(SA_ROLES);
                        await member.roles.remove(allSaRoles);

                        const newRole = SA_ROLES[currentSAs];
                        if (newRole) {
                            await member.roles.add(newRole);
                            actionResult += `\n🏷️ **Rol Actualizado:** El usuario ahora tiene el rol **SA ${currentSAs}**.`;
                        }
                    } catch (e) {
                        console.error(e);
                        actionResult += `\n⚠️ No se pudieron actualizar los roles del usuario.`;
                    }
                } else {
                    actionResult += `\n⚠️ El usuario ya no está en el servidor, no se actualizaron roles.`;
                }

                // Threshold Check
                if (currentSAs >= 5) {
                    const ALERT_CHANNEL_ID = '1456021466356387861';
                    const alertChannel = interaction.client.channels.cache.get(ALERT_CHANNEL_ID);
                    if (alertChannel) {
                        await alertChannel.send({
                            embeds: [{
                                title: '🚨 ALERTA CRÍTICA: Límite de SAs Alcanzado',
                                description: `🛑 **El usuario ha acumulado 5 Sanciones Administrativas (SA) tras una conversión.**\n\n👤 **Usuario:** <@${userId}>\n⚖️ **Sanción Automática Requerida:** BAN PERMANENTE (Directo).\n📜 **Sanción Convertida:** ${sanctionId}`,
                                color: 0xFF0000,
                                timestamp: new Date()
                            }]
                        });
                        actionResult += `\n⛔ **CRÍTICO: El usuario ha alcanzado 5 SAs. Se ha notificado al canal de administración.**`;
                    }
                }

                // Notify User
                try {
                    const user = await interaction.client.users.fetch(userId);

                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🚨 Sanción Convertida a Administrativa (SA)')
                        .setColor('#8B0000') // Dark Red
                        .setDescription(`Tu sanción con ID \`${sanctionId}\` ha sido escalada a **Sanción Administrativa** por la Administración Superior.`)
                        .addFields(
                            { name: '⚠️ ¿Qué implica?', value: 'Las SAs son acumulativas y no caducan. Al llegar a 5, implica expulsión permanente.', inline: false },
                            { name: '📋 Nuevo Motivo', value: newReason, inline: false }
                        )
                        .setFooter({ text: 'Sistema de Gestión de Personal | Nación MX' })
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (e) {
                    console.error('Failed to DM user about SA conversion:', e);
                    actionResult += '\n⚠️ No se pudo enviar MD al usuario.';
                }
            }

            await interaction.editReply({ content: actionResult });

        } catch (error) {
            console.error('Error converting sanction:', error);
            await interaction.editReply({ content: '❌ Ocurrió un error al intentar convertir la sanción.' });
        }
    }
};
