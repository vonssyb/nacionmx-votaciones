const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Muestra el último mensaje eliminado en este canal'),
    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const snipe = client.snipes.get(interaction.channel.id);

        if (!snipe) {
            return interaction.reply({ content: '❌ No hay mensajes eliminados recientemente para mostrar.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: snipe.author.tag, iconURL: snipe.author.displayAvatarURL() })
            .setDescription(snipe.content || '*(Sin contenido de texto)*')
            .setFooter({ text: `Eliminado hace ${Math.floor((Date.now() - snipe.timestamp) / 1000)}s` })
            .setTimestamp(snipe.timestamp)
            .setColor('#FF0000');

        if (snipe.image) {
            embed.setImage(snipe.image);
        }

        await interaction.reply({ embeds: [embed] });
    },
};
