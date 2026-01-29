const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divisa')
        .setDescription('💱 Sistema de Moneda Dual (MXN/USD)')
        .addSubcommand(sub => sub
            .setName('balance')
            .setDescription('Ver tu saldo en Pesos y Dólares')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Ver balance de otro usuario (Admin only)')
                .setRequired(false)))
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
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const subCmd = interaction.options.getSubcommand();
        const exchangeService = client.services.exchange;

        if (subCmd === 'balance') {
            // Get target user (self or specified user if admin)
            let targetUser = interaction.options.getUser('usuario') || interaction.user;

            // Check permissions if viewing another user
            if (targetUser.id !== interaction.user.id) {
                const isAdmin = interaction.member.permissions.has('Administrator');
                if (!isAdmin) {
                    return interaction.editReply({
                        content: '❌ Solo administradores pueden ver el balance de otros usuarios.',
                        flags: [64]
                    });
                }
            }

            try {
                // Get MXN balance (UnbelievaBoat)
                const balance = await client.services.billing.ubService.getUserBalance(interaction.guildId, targetUser.id);

                // Get MXN credit cards
                const { data: mxnCards } = await supabase
                    .from('credit_cards')
                    .select('available_credit')
                    .eq('user_id', targetUser.id)
                    .eq('status', 'active');

                const totalMxnCredit = mxnCards ? mxnCards.reduce((sum, c) => sum + (c.available_credit || 0), 0) : 0;

                // Get USD balance (from user_stats)
                const { data: stats } = await supabase
                    .from('user_stats')
                    .select('usd_cash, exchange_rate_cache')
                    .eq('user_id', targetUser.id)
                    .maybeSingle();

                const usdCash = stats?.usd_cash || 0;
                const exchangeRate = stats?.exchange_rate_cache || 18.50;

                // Get USD credit cards
                const { data: usdCards } = await supabase
                    .from('us_credit_cards')
                    .select('available_credit')
                    .eq('user_id', targetUser.id)
                    .eq('status', 'active');

                const totalUsdCredit = usdCards ? usdCards.reduce((sum, c) => sum + (c.available_credit || 0), 0) : 0;

                // Calculate totals
                const totalMxn = (balance.bank || 0) + (balance.cash || 0) + totalMxnCredit;
                const totalUsd = usdCash + totalUsdCredit;

                // Calculate equivalent
                const usdInMxn = Math.floor(totalUsd * exchangeRate);
                const totalEquivalent = totalMxn + usdInMxn;

                const embed = new EmbedBuilder()
                    .setTitle(`💰 Balance de ${targetUser.tag}`)
                    .setColor('#00D9FF')
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        {
                            name: '🇲🇽 Pesos Mexicanos (MXN)',
                            value: `💵 Efectivo: $${(balance.cash || 0).toLocaleString()}\n🏦 Banco: $${(balance.bank || 0).toLocaleString()}\n💳 Crédito disponible: $${totalMxnCredit.toLocaleString()}\n\n**Total MXN:** $${totalMxn.toLocaleString()}`,
                            inline: false
                        }
                    );

                // Only show USD if user has any
                if (totalUsd > 0) {
                    embed.addFields({
                        name: '🇺🇸 Dólares (USD)',
                        value: `💵 Efectivo: $${usdCash.toLocaleString()}\n💳 Crédito US disponible: $${totalUsdCredit.toLocaleString()}\n\n**Total USD:** $${totalUsd.toLocaleString()}`,
                        inline: false
                    });

                    embed.addFields({
                        name: '📊 Equivalencia Total',
                        value: `**~$${totalEquivalent.toLocaleString()} MXN** ($${Math.floor(totalEquivalent / exchangeRate).toLocaleString()} USD)\n\n_Tasa: 1 USD = $${exchangeRate.toFixed(2)} MXN_`,
                        inline: false
                    });
                }

                embed.setFooter({ text: `Nación MX | Sistema Económico${totalUsd > 0 ? ' | Dual Currency' : ''}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('[divisa balance] Error:', error);
                await interaction.editReply('❌ Error al obtener el balance. Contacta a un administrador.');
            }
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
