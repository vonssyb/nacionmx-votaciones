const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ROLES } = require('../../config/ping_roles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config-pings')
        .setDescription('🔘 Enviar panel de auto-roles (Pings) al canal')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // await interaction.deferReply({ flags: [64] }); // Handled globally by index_moderacion.js

        const channel = interaction.channel;

        const embed = new EmbedBuilder()
            .setTitle('🔕 Configuración de Notificaciones')
            .setDescription('Selecciona los roles que deseas tener para recibir notificaciones.\n\n' +
                '🔘 **Haz clic para agregar/quitar el rol.**\n' +
                '🔔 = Anuncios Importantes\n' +
                '📅 = Eventos y Dinámicas\n' +
                '🆕 = Actualizaciones del Servidor\n' +
                '🎰 = Novedades del Casino\n' +
                '⚔️ = Facciones\n' +
                '💰 = Noticias de Economía')
            .setColor('#2F3136')
            .setFooter({ text: 'Nación MX | Auto-Roles' });

        const rows = [];
        let currentRow = new ActionRowBuilder();
        let count = 0;

        for (const [roleId, config] of Object.entries(ROLES)) {
            let style = ButtonStyle.Secondary;
            if (config.style === 'Primary') style = ButtonStyle.Primary;
            if (config.style === 'Success') style = ButtonStyle.Success;
            if (config.style === 'Danger') style = ButtonStyle.Danger;

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ping_role_${roleId}`)
                    .setLabel(config.label)
                    .setEmoji(config.emoji)
                    .setStyle(style)
            );

            count++;
            if (count % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        }

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        await channel.send({ embeds: [embed], components: rows });

        await interaction.editReply({ content: '✅ Panel de roles enviado exitosamente.' });
    }
};
