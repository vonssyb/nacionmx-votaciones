const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Elimina una cantidad masiva de mensajes del canal actual.')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Número de mensajes a eliminar (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        // Global handler already defers the reply in index_unified.js
        const amount = interaction.options.getInteger('cantidad');

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setDescription(`🗑️ **Se han eliminado ${deleted.size} mensajes.**`)
                .setFooter({ text: `Acción realizada por ${interaction.user.tag}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: '❌ No pude eliminar los mensajes. Asegúrate de que no sean más antiguos de 14 días y que tenga permisos.'
            });
        }
    },
};
