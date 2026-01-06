const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divisa')
        .setDescription('💱 Sistema de Divisas (MXN/USD)')
        .addSubcommand(sub => sub
            .setName('balance')
            .setDescription('Ver tu saldo en Pesos y Dólares'))
        .addSubcommand(sub => sub
            .setName('cambiar')
            .setDescription('Comprar o vender dólares')
            .addStringOption(opt => opt
                .setName('operacion')
                .setDescription('Operación a realizar')
                .setRequired(true)
                .addChoices(
                    { name: '💵 Comprar USD (Pagar MXN)', value: 'comprar' },
                    { name: '🇲🇽 Vender USD (Recibir MXN)', value: 'vender' }
                ))
            .addNumberOption(opt => opt
                .setName('monto')
                .setDescription('Monto en Dólares (USD)')
                .setRequired(true)
                .setMinValue(1)))
        .addSubcommand(sub => sub
            .setName('tasa')
            .setDescription('Ver la tasa de cambio actual')),

    async execute(interaction, client, supabase) {
        const subCmd = interaction.options.getSubcommand();
        const exchangeService = client.services.exchange;

        if (subCmd === 'balance') {
            const balances = await exchangeService.getUserBalances(interaction.guildId, interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('🏦 Tus Balances Financieros')
                .setColor('#2ECC71')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '🇲🇽 Pesos Mexicanos (MXN)', value: `💵 Efectivo: $${balances.mxn.cash.toLocaleString()}\n🏦 Banco: $${balances.mxn.bank.toLocaleString()}\n**Total: $${balances.mxn.total.toLocaleString()} MXN**`, inline: false },
                    { name: '🇺🇸 Dólares Americanos (USD)', value: `💵 Efectivo: $${balances.usd.cash.toLocaleString()}\n🏦 Banco: $${balances.usd.bank.toLocaleString()}\n**Total: $${balances.usd.total.toLocaleString()} USD**`, inline: false }
                )
                .setFooter({ text: 'Nación MX - Sistema Híbrido' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (subCmd === 'tasa') {
            const rate = await exchangeService.getRate(interaction.guildId);
            return interaction.editReply({
                content: `💱 **Tasa de Cambio Actual**\n\n1 USD = **$${rate.toLocaleString()} MXN**`
            });
        }

        if (subCmd === 'cambiar') {
            const operacion = interaction.options.getString('operacion');
            const monto = interaction.options.getNumber('monto');

            try {
                if (operacion === 'comprar') {
                    const result = await exchangeService.buyUSD(interaction.guildId, interaction.user.id, monto);
                    return interaction.editReply({
                        content: `✅ **Compra Exitosa**\n\nHas comprado **$${monto.toLocaleString()} USD** por **$${result.costMXN.toLocaleString()} MXN**.\n(Tasa: 1 USD = $${result.rate} MXN)`
                    });
                } else {
                    const result = await exchangeService.sellUSD(interaction.guildId, interaction.user.id, monto);
                    return interaction.editReply({
                        content: `✅ **Venta Exitosa**\n\nHas vendido **$${monto.toLocaleString()} USD** y recibiste **$${result.gainMXN.toLocaleString()} MXN**.\n(Tasa: 1 USD = $${result.rate} MXN)`
                    });
                }
            } catch (error) {
                return interaction.editReply({
                    content: `❌ **Error:** ${error.message}`
                });
            }
        }
    }
};
