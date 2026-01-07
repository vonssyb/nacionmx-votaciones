const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eliminar_sancion')
        .setDescription('🛡️ [ENCARGADO] Anular/Eliminar una sanción mal aplicada.')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID de la sanción a eliminar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('razon')
                .setDescription('Motivo de la anulación (Requerido para auditoría)')
                .setRequired(true)),

    async execute(interaction) {
        // await interaction.deferReply({ flags: [64] });

        // 1. RBAC CHECK: Only "Encargado de Sanciones" (1456020936229912781)
        // Also allow Admin/Junta for safety/emergency
        const ALLOWED_ROLES = [
            '1451703422800625777', // Encargado de Apelaciones
            '1412882245735420006', // Junta Directiva
            '1412882248411381872'  // Admin
        ];

        const hasPermission = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));

        if (!hasPermission) {
            return interaction.editReply('⛔ **Acceso Denegado:** Este comando es exclusivo del **Encargado de Apelaciones**.');
        }

        const sanctionId = interaction.options.getString('id');
        const reason = interaction.options.getString('razon');

        try {
            // Verify it exists first
            const existing = await interaction.client.services.sanctions.getSanctionById(sanctionId);
            if (!existing) {
                return interaction.editReply('❌ No se encontró la sanción especificada.');
            }

            if (existing.status === 'void') {
                return interaction.editReply('⚠️ Esta sanción ya está anulada.');
            }

            // Execute Void
            await interaction.client.services.sanctions.voidSanction(sanctionId, reason, interaction.user.id);

            // Notify User
            if (existing.discord_user_id) {
                try {
                    const user = await interaction.client.users.fetch(existing.discord_user_id);

                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🛡️ Sanción Anulada / Removida')
                        .setColor('#00FF00') // Green
                        .setDescription(`Tu sanción ha sido **anulada** por el equipo de Apelaciones.\nYa no cuenta en tu historial.`)
                        .addFields(
                            { name: '🆔 ID Sanción', value: `\`${sanctionId}\``, inline: true },
                            { name: '📋 Razón de Anulación', value: reason, inline: false }
                        )
                        .setFooter({ text: 'Nación MX | Moderación', iconURL: interaction.guild.iconURL() })
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Failed to DM user about void:', dmError);
                }
            }

            await interaction.editReply(`✅ **Sanción Anulada Correctamente.**\n🆔: \`${sanctionId}\`\n📋 Estado cambiado a: **VOID**`);

            // Audit Log
            if (interaction.client.logAudit) {
                await interaction.client.logAudit(
                    'Sanción Eliminada / Anulada',
                    `**ID Sanción:** ${sanctionId}\n**Anulada por:** ${interaction.user.tag}\n**Razón de Anulación:** ${reason}\n**Moderador Original:** <@${existing.moderator_id}>`,
                    interaction.user,
                    { id: existing.discord_user_id, tag: 'Usuario Afectado' },
                    0x808080 // Grey for Null/Void
                );
            }

        } catch (error) {
            console.error('Error voiding sanction:', error);
            await interaction.editReply('❌ Error interno al eliminar la sanción.');
        }
    }
};
