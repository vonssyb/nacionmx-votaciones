const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const NotificationTemplates = require('../../services/NotificationTemplates');
const moment = require('moment-timezone');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ver_sancion')
        .setDescription('Ver detalles completos de una sanción específica por ID.')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID de la sanción (UUID)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const sanctionId = interaction.options.getString('id');

        try {
            const sanction = await interaction.client.services.sanctions.getSanctionById(sanctionId);

            if (!sanction) {
                return interaction.editReply('❌ No se encontró ninguna sanción con ese ID.');
            }

            // Fetch User Objects for display
            const moderator = await interaction.client.users.fetch(sanction.moderator_id).catch(() => ({ username: 'Desconocido', id: sanction.moderator_id }));
            const offender = await interaction.client.users.fetch(sanction.discord_user_id).catch(() => ({ username: 'Desconocido', id: sanction.discord_user_id }));

            // Determine Color based on Status
            let color = 0x2f3136; // Default
            if (sanction.status === 'active') color = 0xFF0000;
            if (sanction.status === 'expired') color = 0x00FF00;
            if (sanction.status === 'void') color = 0x808080;

            const date = moment(sanction.created_at).tz('America/Mexico_City').format('DD/MM/YYYY HH:mm');

            const embed = new EmbedBuilder()
                .setTitle(`📜 Detalle de Sanción: ${sanction.type.toUpperCase()}`)
                .setColor(color)
                .addFields(
                    { name: '🆔 ID Sanción', value: `\`${sanction.id}\``, inline: false },
                    { name: '📅 Fecha', value: date, inline: true },
                    { name: '🔋 Estado', value: `**${sanction.status.toUpperCase()}**`, inline: true },
                    { name: '👤 Usuario', value: `${offender.username || 'Unknown'} (<@${sanction.discord_user_id}>)`, inline: false },
                    { name: '👮 Moderador', value: `${moderator.username || 'Unknown'} (<@${sanction.moderator_id}>)`, inline: false },
                    { name: '📝 Motivo/Regla', value: sanction.reason || 'Sin especificar', inline: false },
                    { name: '⚖️ Acción', value: sanction.action_type || 'N/A', inline: True },
                    { name: '⏳ Expiración', value: sanction.expires_at ? moment(sanction.expires_at).tz('America/Mexico_City').format('DD/MM/YYYY HH:mm') : 'Permanente/Manual', inline: true }
                )
                .setFooter({ text: 'Sistema de Archivos Nación MX' })
                .setTimestamp();

            if (sanction.evidence_url) {
                embed.setImage(sanction.evidence_url);
                embed.addFields({ name: '📸 Evidencia', value: `[Ver Imagen Original](${sanction.evidence_url})` });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error al buscar la sanción.');
        }
    }
};
