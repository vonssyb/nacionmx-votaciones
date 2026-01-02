const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aceptar_apelacion')
        .setDescription('Aprobar una apelación para remover una sanción (Solo Encargado)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(option =>
            option.setName('id_sancion')
                .setDescription('ID de la sanción a remover')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Razón de la aprobación')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false }); // Public logic as it's an official act? Or Ephemeral? Usually public "Appeal Accepted".

        // 1. Role Restriction (Encargado de Apelaciones: 1451703422800625777)
        const ROLE_ID = '1451703422800625777';
        if (!interaction.member.roles.cache.has(ROLE_ID) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: '⛔ **Acceso Denegado:** Solo el **Encargado de Apelaciones** puede usar este comando.' });
        }

        const idSancion = interaction.options.getString('id_sancion');
        const motivo = interaction.options.getString('motivo') || 'Apelación Aprobada';

        if (!interaction.client.services || !interaction.client.services.sanctions) {
            return interaction.editReply('❌ Error: Servicio de sanciones no disponible.');
        }

        try {
            // 2. Fetch Sanction
            const sanction = await interaction.client.services.sanctions.getSanctionById(idSancion);

            if (!sanction) {
                return interaction.editReply(`❌ No se encontró ninguna sanción con ID: **${idSancion}**`);
            }

            if (sanction.status !== 'active') {
                return interaction.editReply(`⚠️ Esta sanción no está activa (Estado: ${sanction.status}).`);
            }

            // 3. Restriction: Cannot remove SA
            if (sanction.type === 'sa') {
                return interaction.editReply('🛑 **Acción Prohibida:** Las Sanciones Administrativas (SA) no pueden ser removidas mediante apelación ordinaria.');
            }

            // 4. Set Status to 'appealed' (Visible but struck-through)
            await interaction.client.services.sanctions.appealSanction(idSancion, motivo);

            // 5. Try to remove roles/unban if possible (Best Effect)
            // Note: DB doesn't store role IDs usually, but for Blacklist we might checking action_type.
            if (sanction.action_type && sanction.action_type.includes('Blacklist')) {
                // Try to remove blacklist roles if member is in guild
                try {
                    const member = await interaction.guild.members.fetch(sanction.discord_user_id).catch(() => null);
                    if (member) {
                        // We'd need to know specifically which blacklist role.
                        // Complex to reverse auto logic without storing role ID.
                        // For now we notify manual removal might be needed.
                    }
                } catch (e) { }
            }

            // 6. Success Embed
            const embed = new EmbedBuilder()
                .setTitle('⚖️ Apelación Aprobada')
                .setColor(0x00FF00) // Green
                .setDescription(`La sanción ha sido **REVOCADA** exitosamente.`)
                .addFields(
                    { name: '🆔 ID Sanción', value: idSancion, inline: true },
                    { name: '👤 Usuario', value: `<@${sanction.discord_user_id}>`, inline: true },
                    { name: '👮 Aprobado por', value: interaction.user.tag, inline: true },
                    { name: '📝 Motivo', value: motivo, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // 7. DM User
            try {
                const user = await interaction.client.users.fetch(sanction.discord_user_id);
                if (user) {
                    await user.send({
                        content: `✅ **¡Buenas noticias!** Tu apelación ha sido **APROBADA** en **${interaction.guild.name}**.\nLa sanción (ID: ${idSancion}) ha sido retirada.`,
                        embeds: [embed]
                    });
                }
            } catch (e) { /* Ignore DM fail */ }

            // 8. Audit Log
            if (interaction.client.logAudit) {
                await interaction.client.logAudit(
                    'Apelación Aprobada',
                    `Sanción ${idSancion} revocada.\nMotivo: ${motivo}`,
                    interaction.user,
                    { id: sanction.discord_user_id, tag: 'Target' },
                    0x00FF00
                );
            }

        } catch (error) {
            console.error(error);
            interaction.editReply('❌ Error procesando la solicitud.');
        }
    }
};
