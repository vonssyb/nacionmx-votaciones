const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-erlc')
        .setDescription('🛠️ Configurar el tablero de estado de ERLC')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        // start of execute
        try {
            // Note: index_moderacion.js auto-defers, so we don't need to defer here.

            // 1. Send Initial Message
            const embed = new EmbedBuilder()
                .setTitle('📶 Estado del Servidor: Nación MX')
                .setColor('#FFFF00')
                .setDescription('Conectando con la API...')
                .setFooter({ text: 'Actualizado cada 60 segundos' })
                .setTimestamp();

            const message = await interaction.channel.send({ embeds: [embed] });

            // 2. Save Config
            const config = {
                statusChannelId: interaction.channelId,
                statusMessageId: message.id
            };

            const configPath = path.join(__dirname, '../../data/erlc_config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // 3. Force first update if service is available
            if (client.services && client.services.erlc) {
                // We can't easily call the interval function directly unless exposed.
                // But next interval tick will catch it.
            }

            await interaction.editReply('✅ **Tablero Configurado**\nEl mensaje de estado se actualizará automáticamente en este canal.');

        } catch (error) {
            console.error('[setup-erlc] Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }
};
