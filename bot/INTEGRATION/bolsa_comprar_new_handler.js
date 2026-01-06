const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Este es el nuevo handler de /bolsa comprar que usa botones en lugar de parámetro directo
// Para integrar este código, reemplaza las líneas 7105-7142 en legacyEconomyHandler.js

async function bolsaComprarHandler(interaction, supabase, billingService, getStockPrice, STOCKS, getAvailablePaymentMethods, createPaymentButtons, processPayment) {
    const subCmd = interaction.options.getSubcommand();

    if (subCmd === 'comprar') {
        const symbol = interaction.options.getString('empresa').toUpperCase();
        const qty = interaction.options.getNumber('cantidad');

        if (!STOCKS[symbol]) return interaction.editReply('❌ Empresa no cotizada. Usa `/bolsa ver`.');
        if (qty <= 0) return interaction.editReply('❌ Cantidad inválida.');

        const price = getStockPrice(symbol);
        const totalCost = price * qty;

        try {
            // Get available payment methods
            const availableMethods = await getAvailablePaymentMethods(interaction.user.id, interaction.guildId);
            const paymentButtons = createPaymentButtons(availableMethods, 'stock_buy');

            // Create purchase embed
            const purchaseEmbed = new EmbedBuilder()
                .setTitle('📈 Compra de Acciones')
                .setColor('#00AAFF')
                .setDescription(`**${STOCKS[symbol].name} (${symbol})**`)
                .addFields(
                    { name: '📊 Precio por Acción', value: `$${price.toLocaleString()}`, inline: true },
                    { name: '📦 Cantidad', value: `${qty} acc.`, inline: true },
                    { name: '💰 Costo Total', value: `**$${totalCost.toLocaleString()}**`, inline: false },
                    { name: '💳 Método de Pago', value: 'Selecciona abajo:', inline: false }
                )
                .setFooter({ text: '⚡ Comisión: 2% Efectivo/Banco | 5% Crédito' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [purchaseEmbed],
                components: [paymentButtons]
            });

            // Wait for payment selection
            const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('stock_buy_');
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const method = i.customId.replace('stock_buy_', '');

                    // Calculate fees based on method  
                    const fees = method === 'credit' ? 0.05 : 0.02;
                    const costWithFee = Math.floor(totalCost * (1 + fees));

                    // Process payment
                    const paymentResult = await processPayment(
                        method,
                        interaction.user.id,
                        interaction.guildId,
                        costWithFee,
                        `Compra de ${qty} acciones de ${symbol}`,
                        availableMethods
                    );

                    if (!paymentResult.success) {
                        return i.editReply({
                            content: paymentResult.error,
                            embeds: [],
                            components: []
                        });
                    }

                    // Update portfolio
                    const { data: current } = await supabase
                        .from('stock_portfolios')
                        .select('*')
                        .eq('discord_user_id', interaction.user.id)
                        .eq('stock_symbol', symbol)
                        .maybeSingle();

                    if (current) {
                        await supabase
                            .from('stock_portfolios')
                            .update({ shares: current.shares + qty })
                            .eq('id', current.id);
                    } else {
                        await supabase
                            .from('stock_portfolios')
                            .insert({
                                discord_user_id: interaction.user.id,
                                stock_symbol: symbol,
                                shares: qty
                            });
                    }

                    // Success embed
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Compra Exitosa')
                        .setDescription(`Has comprado **${qty} acciones** de **${STOCKS[symbol].name}**`)
                        .addFields(
                            { name: '📊 Símbolo', value: symbol, inline: true },
                            { name: '💰 Precio', value: `$${price.toLocaleString()}/acc`, inline: true },
                            { name: '📦 Cantidad', value: `${qty}`, inline: true },
                            { name: '💸 Comisión', value: `$${(costWithFee - totalCost).toLocaleString()} (${fees * 100}%)`, inline: true },
                            { name: '💳 Método', value: paymentResult.method, inline: true },
                            { name: '🔢 Total Pagado', value: `**$${costWithFee.toLocaleString()}**`, inline: true }
                        )
                        .setFooter({ text: 'Ver tu portafolio con /bolsa portafolio' })
                        .setTimestamp();

                    await i.editReply({ embeds: [successEmbed], components: [] });

                } catch (error) {
                    console.error('[bolsa comprar] Error:', error);
                    await i.editReply({
                        content: '❌ Error procesando la compra.',
                        embeds: [],
                        components: []
                    });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({
                        content: '⏰ Tiempo agotado para la compra.',
                        embeds: [],
                        components: []
                    });
                }
            });

        } catch (error) {
            console.error('[bolsa comprar] Error:', error);
            return interaction.editReply('❌ Error al iniciar la compra.');
        }
    }
}

module.exports = { bolsaComprarHandler };
