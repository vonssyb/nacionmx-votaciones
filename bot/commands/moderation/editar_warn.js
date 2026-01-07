const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editar_warn')
        .setDescription('Editar una sanción existente (Solo Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(option =>
            option.setName('id_sancion')
                .setDescription('ID de la sanción a editar (Ver /ver_warns)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nuevo_motivo')
                .setDescription('Nuevo motivo de la sanción')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('nueva_evidencia')
                .setDescription('Nueva URL de evidencia')
                .setRequired(false)),

    async execute(interaction) {
        // SECURITY CHECK
        const authorizedIds = [
            '1450242487422812251',
            '1456020936229912781'
        ];
        const isAuthorized = authorizedIds.includes(interaction.user.id) ||
            interaction.member.roles.cache.has('1450242487422812251') ||
            interaction.member.roles.cache.has('1456020936229912781');

        if (!isAuthorized && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '🛑 No tienes permiso para editar sanciones.', flags: [64] });
        }

        // await interaction.deferReply({ flags: [64] });

        const sanctionId = interaction.options.getString('id_sancion');
        const newReason = interaction.options.getString('nuevo_motivo');
        const newEvidence = interaction.options.getString('nueva_evidencia');

        if (!newReason && !newEvidence) {
            return interaction.editReply('⚠️ Debes proporcionar al menos un campo para cambiar (Motivo o Evidencia).');
        }

        try {
            const service = interaction.client.services.sanctions;

            // Check existence
            const existing = await service.getSanctionById(sanctionId);
            if (!existing) {
                return interaction.editReply('❌ No se encontró ninguna sanción con ese ID.');
            }

            // Update
            const updates = {};
            if (newReason) updates.reason = newReason;
            if (newEvidence) updates.evidence_url = newEvidence;

            await service.updateSanction(sanctionId, updates);

            // Notify User
            if (existing.discord_user_id) {
                try {
                    const user = await interaction.client.users.fetch(existing.discord_user_id);

                    const dmEmbed = new EmbedBuilder()
                        .setTitle('✏️ Sanción Editada / Actualizada')
                        .setColor('#FFA500') // Orange
                        .setDescription(`Los detalles de tu sanción en **${interaction.guild.name}** han sido modificados.`)
                        .addFields(
                            { name: '🆔 ID Sanción', value: `\`${sanctionId}\``, inline: true }
                        )
                        .setTimestamp();

                    if (newReason) dmEmbed.addFields({ name: '📄 Nuevo Motivo', value: newReason, inline: false });
                    if (newEvidence) {
                        dmEmbed.addFields({ name: '📎 Nueva Evidencia', value: newEvidence, inline: false });
                        dmEmbed.setImage(newEvidence); // Optional: show image
                    }

                    await user.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Could not DM user about edit:', dmError);
                }
            }

            await interaction.editReply(`✅ **Sanción #${sanctionId} actualizada correctamente.**\n${newReason ? `📄 Motivo: ${newReason}\n` : ''}${newEvidence ? `📎 Evidencia: [Ver](${newEvidence})` : ''}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al actualizar la sanción.');
        }
    }
};
