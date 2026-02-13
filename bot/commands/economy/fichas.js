const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const CasinoService = require('../../services/CasinoService');
const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
const { CARD_TIERS } = require('../../services/EconomyHelper');

const COLORS = {
    SUCCESS: '#2ECC71',
    INFO: '#3498DB',
    WARNING: '#F39C12',
    ERROR: '#E74C3C'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fichas')
        .setDescription('🎰 Gestión de Fichas de Casino')
        .addSubcommand(subcommand =>
            subcommand
                .setName('comprar')
                .setDescription('💵 Comprar fichas de casino (Menú Interactivo)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('vender')
                .setDescription('💰 Vender fichas por dinero')
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('Cantidad de fichas a vender')
                        .setRequired(true)
                        .setMinValue(100))
                .addStringOption(option =>
                    option.setName('metodo')
                        .setDescription('Dónde recibir el dinero')
                        .setRequired(true)
                        .addChoices(
                            { name: '💵 Efectivo', value: 'efectivo' },
                            { name: '💳 Cuenta Bancaria', value: 'debito' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('🎰 Ver tu balance de fichas'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('📊 Ver tus estadísticas de casino')),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const casinoService = new CasinoService(supabase);
        const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN || process.env.DISCORD_TOKEN_UB, supabase);

        try {
            if (subcommand === 'comprar') {
                await interaction.deferReply();

                // Select Amount UI
                const amountEmbed = new EmbedBuilder()
                    .setTitle('🎰 Comprar Fichas')
                    .setDescription('Selecciona la cantidad de fichas que deseas comprar:\n($1 = 1 Ficha)')
                    .setColor(COLORS.INFO)
                    .setFooter({ text: 'Sistema de Casino NacionMX' });

                const rowAmounts = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('buy_chips_150').setLabel('$150').setStyle(ButtonStyle.Primary).setEmoji('💰'),
                    new ButtonBuilder().setCustomId('buy_chips_250').setLabel('$250').setStyle(ButtonStyle.Primary).setEmoji('💰'),
                    new ButtonBuilder().setCustomId('buy_chips_500').setLabel('$500').setStyle(ButtonStyle.Primary).setEmoji('💰'),
                    new ButtonBuilder().setCustomId('buy_chips_1000').setLabel('$1,000').setStyle(ButtonStyle.Success).setEmoji('💰'),
                    new ButtonBuilder().setCustomId('buy_chips_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
                );

                const message = await interaction.editReply({ embeds: [amountEmbed], components: [rowAmounts] });

                // Create Collector
                const filter = i => i.user.id === interaction.user.id;
                const collector = message.createMessageComponentCollector({ filter, time: 60000 });

                collector.on('collect', async i => {
                    const id = i.customId;

                    if (id === 'buy_chips_cancel') {
                        await i.update({ content: '❌ Compra cancelada.', embeds: [], components: [] });
                        collector.stop();
                        return;
                    }

                    if (id.startsWith('buy_chips_')) {
                        const amount = parseInt(id.replace('buy_chips_', ''));

                        // Select Method UI
                        const methodEmbed = new EmbedBuilder()
                            .setTitle('💳 Método de Pago')
                            .setDescription(`Monto a pagar: **$${amount.toLocaleString()}**\n\nSelecciona tu método de pago:`)
                            .setColor(COLORS.INFO);

                        const rowMethods = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_buy_${amount}_efectivo`).setLabel('Efectivo').setStyle(ButtonStyle.Success).setEmoji('💵'),
                            new ButtonBuilder().setCustomId(`confirm_buy_${amount}_debito`).setLabel('Tarjeta Débito').setStyle(ButtonStyle.Primary).setEmoji('💳'),
                            new ButtonBuilder().setCustomId(`confirm_buy_${amount}_credito`).setLabel('Tarjeta Crédito').setStyle(ButtonStyle.Secondary).setEmoji('💳')
                        );

                        await i.update({ embeds: [methodEmbed], components: [rowMethods] });
                        return;
                    }

                    if (id.startsWith('confirm_buy_')) {
                        // confirm_buy_150_efectivo
                        const parts = id.split('_');
                        const amount = parseInt(parts[2]);
                        const method = parts[3];

                        await i.deferUpdate(); // Prevent interaction failure

                        // === PAYMENT LOGIC REUSED ===
                        let paymentSuccess = false;
                        let errorMsg = '';

                        if (method === 'efectivo' || method === 'debito') {
                            const balance = await ubService.getUserBalance(guildId, userId);
                            const currentFunds = method === 'efectivo' ? balance.cash : balance.bank;

                            if (currentFunds < amount) {
                                errorMsg = `❌ Fondos insuficientes en ${method === 'efectivo' ? 'Efectivo' : 'Banco'}.\nTienes: $${currentFunds.toLocaleString()}`;
                            } else {
                                const result = await ubService.removeMoney(guildId, userId, amount, 'Compra de Fichas Casino', method === 'efectivo' ? 'cash' : 'bank');
                                if (result.success) paymentSuccess = true;
                                else errorMsg = '❌ Error al procesar pago con banco.';
                            }
                        } else if (method === 'credito') {
                            const { data: cards } = await supabase
                                .from('credit_cards')
                                .select('*')
                                .or(`discord_id.eq.${userId},discord_user_id.eq.${userId}`)
                                .eq('status', 'active');

                            if (!cards || cards.length === 0) {
                                errorMsg = '❌ No tienes tarjeta de crédito activa.';
                            } else {
                                const card = cards[0];
                                const tierInfo = CARD_TIERS[card.card_type];
                                const currentDebt = card.current_balance || 0;

                                if (!tierInfo) {
                                    errorMsg = '❌ Error de tarjeta (Tier desconocido).';
                                } else if (currentDebt + amount > tierInfo.limit) {
                                    errorMsg = `❌ Límite excedido.\nDisp: $${(tierInfo.limit - currentDebt).toLocaleString()}`;
                                } else {
                                    const { error: upErr } = await supabase.from('credit_cards').update({
                                        current_balance: currentDebt + amount,
                                        last_used_at: new Date().toISOString()
                                    }).eq('id', card.id);

                                    if (!upErr) paymentSuccess = true;
                                    else errorMsg = '❌ Error DB tarjeta crédito.';
                                }
                            }
                        }

                        if (!paymentSuccess) {
                            await interaction.editReply({ content: errorMsg, embeds: [], components: [] });
                        } else {
                            // Add Chips via TransactionManager
                            const tx = await casinoService.transactionManager.executeCasinoChipsExchange(userId, amount, amount, 'buy');

                            if (!tx.success) {
                                // Refund Money if chips failed
                                const refundMethod = method === 'efectivo' ? 'cash' : 'bank';
                                if (method === 'credito') {
                                    // Refund credit card? Complex. Just log error for now or try to revert credit card balance.
                                    // For now, manual refund message.
                                    const { data: cards } = await supabase.from('credit_cards').select('current_balance').eq('discord_id', userId).eq('status', 'active');
                                    if (cards && cards[0]) {
                                        await supabase.from('credit_cards').update({ current_balance: cards[0].current_balance - amount }).eq('discord_id', userId);
                                    }
                                } else {
                                    await ubService.addMoney(guildId, userId, amount, 'Reembolso Fichas Fallido', refundMethod);
                                }
                                return interaction.editReply({ content: `❌ Error al entregar fichas: ${tx.error}`, embeds: [], components: [] });
                            }

                            const currentChips = tx.newChipsBalance;

                            const finalEmbed = new EmbedBuilder()
                                .setTitle('🎰 Compra Exitosa')
                                .setDescription(`Has comprado **${amount.toLocaleString()}** fichas.`)
                                .addFields(
                                    { name: '💸 Costo', value: `$${amount.toLocaleString()}`, inline: true },
                                    { name: '💳 Método', value: method.toUpperCase(), inline: true },
                                    { name: '💰 Balance de Fichas', value: `${(currentChips + amount).toLocaleString()}`, inline: true }
                                )
                                .setColor(COLORS.SUCCESS)
                                .setTimestamp();

                            await interaction.editReply({ embeds: [finalEmbed], components: [] });
                        }
                        collector.stop();
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        interaction.editReply({ content: '⏱️ Tiempo agotado.', components: [] }).catch(() => { });
                    }
                });

            } else if (subcommand === 'vender') {
                const amount = interaction.options.getInteger('cantidad');
                const metodo = interaction.options.getString('metodo'); // efectivo or debito

                await interaction.deferReply();

                // Check chips using CasinoService for consistency
                const check = await casinoService.checkChips(userId, amount);
                if (!check.hasEnough) {
                    return interaction.editReply({ content: check.message });
                }

                // Remove Chips first via TransactionManager
                const tx = await casinoService.transactionManager.executeCasinoChipsExchange(userId, amount, amount, 'sell');

                if (!tx.success) {
                    return interaction.editReply({ content: tx.error });
                }

                // Add Money via UB
                let ubMethod = metodo === 'efectivo' ? 'cash' : 'bank';
                const result = await ubService.addMoney(guildId, userId, amount, 'Venta de Fichas Casino', ubMethod);

                if (!result.success) {
                    // Rollback chips (Refund them back)
                    await casinoService.transactionManager.executeCasinoChipsExchange(userId, amount, amount, 'buy');
                    return interaction.editReply({ content: '❌ Error al depositar el dinero. Se han devuelto las fichas.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle('💰 Venta Exitosa')
                    .setDescription(`Has vendido **${amount.toLocaleString()}** fichas.`)
                    .addFields(
                        { name: '💵 Recibido', value: `$${amount.toLocaleString()}`, inline: true },
                        { name: '🏦 Destino', value: metodo === 'efectivo' ? 'Bolsillo' : 'Banco', inline: true },
                        { name: '🎰 Fichas Restantes', value: `${(check.balance - amount).toLocaleString()}`, inline: true }
                    )
                    .setColor(COLORS.SUCCESS);

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'balance') {
                const { data: account } = await supabase
                    .from('casino_chips')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                const balance = account?.chips || 0;

                const embed = new EmbedBuilder()
                    .setTitle('🎰 Balance de Casino')
                    .setDescription(`Tu balance actual de fichas:`)
                    .addFields(
                        { name: '🪙 Fichas', value: `**${balance.toLocaleString()}**`, inline: true },
                        { name: '💵 Valor en efectivo', value: `$${balance.toLocaleString()}`, inline: true }
                    )
                    .setColor(COLORS.INFO)
                    .setFooter({ text: 'Usa /fichas comprar para obtener más' });

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'stats') {
                const { data: account } = await supabase
                    .from('casino_chips')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!account) {
                    return interaction.reply({ content: '❌ Aún no has jugado en el casino.', ephemeral: true });
                }

                const profit = (account.total_won || 0) - (account.total_lost || 0);

                const embed = new EmbedBuilder()
                    .setTitle('📊 Estadísticas de Casino')
                    .setColor(COLORS.INFO)
                    .addFields(
                        { name: '🎮 Juegos Jugados', value: `${account.games_played || 0}`, inline: true },
                        { name: '💰 Total Ganado', value: `${(account.total_won || 0).toLocaleString()} fichas`, inline: true },
                        { name: '💸 Total Perdido', value: `${(account.total_lost || 0).toLocaleString()} fichas`, inline: true },
                        { name: '📈 Neto', value: `${profit > 0 ? '+' : ''}${profit.toLocaleString()} fichas`, inline: false }
                    );

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Fichas] Error:', error);
            const errMsg = `❌ Error: ${error.message || 'Error desconocido'}`;
            if (interaction.deferred) {
                await interaction.editReply({ content: errMsg, embeds: [], components: [] }).catch(() => { });
            } else {
                await interaction.reply({ content: errMsg, ephemeral: true }).catch(() => { });
            }
        }
    }
};
