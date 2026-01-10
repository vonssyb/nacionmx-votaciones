const { EmbedBuilder } = require('discord.js');

const handleCurrencyCommand = async (interaction, exchangeService) => {
    const subcommand = interaction.options.getSubcommand();

    try {
        if (subcommand === 'tasa') {
            await handleTasa(interaction, exchangeService);
        } else if (subcommand === 'set-tasa') {
            await handleSetTasa(interaction, exchangeService);
        }
    } catch (error) {
        console.error('❌ [CurrencyHandler] Error:', error);
        await interaction.editReply({
            content: '❌ Ocurrió un error al procesar el comando de divisa.',
            ephemeral: true
        }).catch(() => { });
    }
};

const handleTasa = async (interaction, exchangeService) => {
    await interaction.deferReply();
    const rate = await exchangeService.getCurrentRate();
    const today = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });

    const embed = new EmbedBuilder()
        .setTitle('📈 Tasa de Cambio Oficial (USD/MXN)')
        .setColor('#2ecc71') // Green
        .setDescription(`Precio del Dólar hoy **${today}**`)
        .addFields(
            { name: '🇺🇸 1 USD', value: `🇲🇽 $${rate.toFixed(2)} MXN`, inline: true },
            { name: '🇲🇽 1,000 MXN', value: `🇺🇸 $${(1000 / rate).toFixed(2)} USD`, inline: true }
        )
        .setFooter({ text: 'Sistema Financiero Nación MX', iconURL: 'https://i.imgur.com/8QZ7Z9A.png' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
};

const handleSetTasa = async (interaction, exchangeService) => {
    await interaction.deferReply({ ephemeral: true });

    // 1. Verify Permissions (Admin Only)
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({ content: '❌ Solo administradores pueden establecer la tasa de cambio.' });
    }

    const newRate = interaction.options.getNumber('valor');
    if (newRate <= 0) {
        return interaction.editReply({ content: '❌ La tasa debe ser un número positivo.' });
    }

    // 2. Set Rate
    await exchangeService.setManualRate(interaction.user.tag, newRate);

    // 3. Success Embed
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Tasa de Cambio Actualizada')
        .setColor('#e67e22') // Orange
        .setDescription(`La tasa de cambio ha sido establecida manualmente por **${interaction.user.tag}**.`)
        .addFields(
            { name: 'Nueva Tasa', value: `$${newRate.toFixed(2)} MXN / USD`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Opcional: Anunciar en un canal público si se desea
};

module.exports = { handleCurrencyCommand };
