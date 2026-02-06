const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EconomyHelper = require('../../services/EconomyHelper');
const StockService = require('../../services/StockService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bolsa')
        .setDescription('📈 Mercado de Valores (Bolsa)')
        .addSubcommand(sub =>
            sub.setName('ver')
                .setDescription('Ver el mercado de valores actual'))
        .addSubcommand(sub =>
            sub.setName('portafolio')
                .setDescription('Ver tus inversiones'))
        .addSubcommand(sub =>
            sub.setName('comprar')
                .setDescription('Comprar acciones')
                .addStringOption(opt => opt.setName('ticker').setDescription('Símbolo de la empresa (ej: MEX)').setRequired(true))
                .addIntegerOption(opt => opt.setName('cantidad').setDescription('Número de acciones').setRequired(true).setMinValue(1)))
        .addSubcommand(sub =>
            sub.setName('vender')
                .setDescription('Vender acciones')
                .addStringOption(opt => opt.setName('ticker').setDescription('Símbolo de la empresa').setRequired(true))
                .addIntegerOption(opt => opt.setName('cantidad').setDescription('Número de acciones').setRequired(true).setMinValue(1))),

    async execute(interaction, client, supabase) {
        // Assume StockService is initialized in client.services.stocks
        // If not, instantiate locally for safety/testing
        const stockService = client.services?.stocks || new StockService(supabase);
        const ubService = client.services?.billing?.ubService || client.billingService?.ubService || (client.services && client.services.billing && client.services.billing.ubService);

        if (!ubService) {
            console.error('[Bolsa] Error: UB Service not found');
            return interaction.reply({ content: '❌ Error: Servicio de economía no disponible (UB Missing).', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'ver') {
                await interaction.deferReply(); // Prevent timeout
                const marketData = await stockService.getMarketData();

                if (!marketData || marketData.length === 0) {
                    return interaction.editReply('📉 El mercado está cerrado o no hay empresas listadas.');
                }

                // Format Market View
                const embed = new EmbedBuilder()
                    .setTitle('📈 Bolsa de Valores de Nación MX')
                    .setColor('#0099ff')
                    .setTimestamp();

                // Separate Companies (Default to 'user' if type is missing/legacy)
                const userCompanies = marketData.filter(c => !c.company_type || c.company_type === 'user');
                const systemCompanies = marketData.filter(c => c.company_type === 'system');

                let desc = "";

                if (userCompanies.length > 0) {
                    desc += "🏢 **EMPRESAS REALES**\n";
                    userCompanies.slice(0, 5).forEach(c => {
                        const price = parseFloat(c.stock_price).toFixed(2);
                        const changeIcon = parseFloat(c.volatility) > 0 ? '📊' : '➖';
                        desc += `**${c.ticker}** | ${c.name}\n💲 $${price} | ${changeIcon} Cap: $${(c.stock_price * c.total_shares / 1000000).toFixed(1)}M\n\n`;
                    });
                    if (userCompanies.length > 5) desc += `*...y ${userCompanies.length - 5} más*\n\n`;
                }

                if (systemCompanies.length > 0) {
                    desc += "🤖 **INDICES NACIONALES (Ficticias)**\n";
                    systemCompanies.slice(0, 10).forEach(c => {
                        const price = parseFloat(c.stock_price).toFixed(2);
                        desc += `**${c.ticker}** | ${c.name}\n💲 $${price} | 📊 Vol: ${(c.volatility * 100).toFixed(1)}%\n\n`;
                    });
                }

                embed.setDescription(desc || "No hay información disponible.");
                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'portafolio') {
                await interaction.deferReply({ ephemeral: true }); // Private view default?
                const { data: portfolio } = await supabase
                    .from('stock_portfolio')
                    .select('*, companies(name, ticker, stock_price)')
                    .eq('user_id', interaction.user.id)
                    .gt('quantity', 0);

                if (!portfolio || portfolio.length === 0) {
                    return interaction.editReply({ content: '💼 No tienes inversiones activas.' });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`💼 Portafolio de ${interaction.user.username}`)
                    .setColor('#f1c40f');

                let totalValue = 0;
                let totalInvested = 0;

                const fields = portfolio.map(p => {
                    const currentPrice = p.companies?.stock_price || 0;
                    const currentValue = currentPrice * p.quantity;
                    const invested = p.average_buy_price * p.quantity;
                    const profitInfo = currentValue - invested;
                    const profitPercent = invested > 0 ? ((profitInfo / invested) * 100).toFixed(1) : 0;

                    totalValue += currentValue;
                    totalInvested += invested;

                    const icon = profitInfo >= 0 ? '🟢' : '🔴';

                    return {
                        name: `${p.companies?.ticker || '???'} (${p.quantity} acciones)`,
                        value: `Precio: $${currentPrice.toFixed(2)}\nValor: $${currentValue.toLocaleString()}\n${icon} P/L: $${profitInfo.toFixed(2)} (${profitPercent}%)`
                    };
                });

                embed.addFields(fields);
                embed.setDescription(`**Valor Total:** $${totalValue.toLocaleString()}\n**Inversión Total:** $${totalInvested.toLocaleString()}\n**Beneficio Total:** $${(totalValue - totalInvested).toLocaleString()}`);

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'comprar') {
                const ticker = interaction.options.getString('ticker').toUpperCase();
                const cantidad = interaction.options.getInteger('cantidad');

                await interaction.deferReply();

                // 1. Fetch details for preview
                const { data: company } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('ticker', ticker)
                    .single();

                if (!company) {
                    return interaction.editReply({ content: '❌ Empresa no encontrada.' });
                }

                const totalCost = Number(company.stock_price) * cantidad;

                // 2. Confirmation Embed
                const confirmEmbed = new EmbedBuilder()
                    .setTitle(`🏦 Confirmar Compra: ${ticker}`)
                    .setColor('#f1c40f')
                    .setDescription(`Estás a punto de comprar **${cantidad}** acciones de **${company.name}**.\n\n` +
                        `💵 **Precio Total:** $${totalCost.toLocaleString()}\n` +
                        `🧾 **Precio/Acción:** $${Number(company.stock_price).toFixed(2)}`)
                    .setFooter({ text: 'Selecciona método de pago o cancela.' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('pay_cash').setLabel('💵 Efectivo').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('pay_debit').setLabel('💳 Débito').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('pay_credit').setLabel('💳 Crédito').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('pay_cancel').setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
                );

                const msg = await interaction.editReply({ embeds: [confirmEmbed], components: [buttons] });

                // 3. Collect Interaction
                try {
                    const confirmation = await msg.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000
                    });

                    if (confirmation.customId === 'pay_cancel') {
                        await confirmation.update({ content: '❌ Compra cancelada por el usuario.', embeds: [], components: [] });
                        return;
                    }

                    // Map button to method
                    const methodMap = {
                        'pay_cash': 'cash',
                        'pay_debit': 'bank',
                        'pay_credit': 'credit' // Supported if logic allows
                    };
                    const method = methodMap[confirmation.customId];

                    // Execute Buy
                    const result = await stockService.buyStock(interaction.user.id, interaction.guildId, ticker, cantidad, ubService, method);

                    const resultEmbed = new EmbedBuilder()
                        .setColor(result.success ? '#2ecc71' : '#e74c3c')
                        .setDescription(result.message);

                    await confirmation.update({ embeds: [resultEmbed], components: [] });

                } catch (e) {
                    await interaction.editReply({ content: '⏱️ Tiempo de espera agotado. Compra cancelada.', components: [] });
                }
                return;

            } else if (subcommand === 'vender') {
                const ticker = interaction.options.getString('ticker').toUpperCase();
                const cantidad = interaction.options.getInteger('cantidad');

                await interaction.deferReply();
                const result = await stockService.sellStock(interaction.user.id, interaction.guildId, ticker, cantidad, ubService);

                const embed = new EmbedBuilder()
                    .setColor(result.success ? '#2ecc71' : '#e74c3c')
                    .setDescription(result.message);

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Bolsa] Error:', error);
            if (!interaction.replied && !interaction.deferred) {
                interaction.reply({ content: `❌ Error al procesar la solicitud: ${error.message}`, ephemeral: true });
            } else {
                interaction.editReply({ content: `❌ Error al procesar la solicitud: ${error.message}` });
            }
        }
    }
};
