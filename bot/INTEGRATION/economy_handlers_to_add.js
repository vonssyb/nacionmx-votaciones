// ===================================================================
// AGREGAR ESTO A bot/index.js
// ===================================================================

// 1. EN LA SECCIÓN DE IMPORTS (después de línea 7):
// Ya agregado: const StakingService = require('./services/StakingService');
// Ya agregado: const SlotsService = require('./services/SlotsService');

// 2. EN LA SECCIÓN DE INICIALIZACIÓN (después de línea 45):
// Ya agregado: let stakingService, slotsService;

// 3. DENTRO DE client.once('ready', ...) AL FINAL, AGREGAR:
//    stakingService = new StakingService(supabase);
//    slotsService = new SlotsService(supabase);
//    console.log('✅ Economy services initialized');

// 4. AGREGAR ESTOS HANDLERS AL FINAL DE LA SECCIÓN DE COMANDOS
//    (Después del último } else if (commandName === '...'))

    // ===================================================================
    // NEW ECONOMY COMMANDS HANDLERS
    // ===================================================================
    
    else if (commandName === 'stake') {
    try {
        await interaction.deferReply();
    } catch (err) {
        console.error('[ERROR] Failed to defer stake:', err);
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'depositar') {
        const crypto = interaction.options.getString('crypto').toUpperCase();
        const cantidad = interaction.options.getNumber('cantidad');
        const dias = interaction.options.getInteger('dias');

        // Validate
        if (!['BTC', 'ETH', 'SOL'].includes(crypto)) {
            return interaction.editReply('❌ Crypto inválida. Usa: BTC, ETH, SOL');
        }

        if (![7, 30, 90].includes(dias)) {
            return interaction.editReply('❌ Períodos válidos: 7, 30, o 90 días');
        }

        try {
            // Check portfolio
            const { data: portfolio } = await supabase
                .from('stock_portfolios')
                .select('*')
                .eq('discord_user_id', interaction.user.id)
                .eq('stock_symbol', crypto)
                .single();

            if (!portfolio || portfolio.shares < cantidad) {
                return interaction.editReply('❌ No tienes suficiente crypto. Compra primero con `/bolsa comprar`');
            }

            // Remove from portfolio
            await supabase
                .from('stock_portfolios')
                .update({ shares: portfolio.shares - cantidad })
                .eq('id', portfolio.id);

            // Create stake
            const stake = await stakingService.createStake(
                interaction.user.id,
                crypto,
                cantidad,
                dias
            );

            const rates = stakingService.rates[crypto];
            const apy = rates[dias] * 100;
            const estimatedEarnings = (cantidad * rates[dias] * dias / 365).toFixed(4);

            await interaction.editReply({
                content: `✅ **Staking Exitoso!**\n\n🔒 **${cantidad}** ${crypto} bloqueado por **${dias} días**\n📊 APY: **${apy.toFixed(1)}%**\n💰 Earnings estimados: **${estimatedEarnings}** ${crypto}\n\n_Usa \`/stake mis-stakes\` para ver todos tus stakes._`
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Error creando stake.');
        }
    }

    else if (subcommand === 'mis-stakes') {
        const stakes = await stakingService.getUserStakes(interaction.user.id);

        if (stakes.length === 0) {
            return interaction.editReply('📊 No tienes stakes activos. Usa `/stake depositar` para empezar.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🔒 Tus Stakes Activos')
            .setColor(0x00FF00)
            .setFooter({ text: 'Usa /stake retirar [id] para retirar stakes desbloqueados' });

        stakes.forEach(s => {
            const endDate = new Date(s.end_date);
            const isUnlocked = Date.now() > endDate.getTime();
            const status = isUnlocked ? '🔓 DESBLOQUEADO' : `🔒 Bloqueado hasta ${endDate.toLocaleDateString()}`;

            embed.addFields({
                name: `${s.crypto_symbol} - ${s.amount} unidades`,
                value: `APY: ${s.apy}%\n${status}\nID: \`${s.id.substring(0, 8)}\``
            });
        });

        await interaction.editReply({ embeds: [embed] });
    }

    else if (subcommand === 'retirar') {
        const stakeId = interaction.options.getString('id');

        try {
            const { amount, earnings } = await stakingService.withdrawStake(stakeId, interaction.user.id);

            await interaction.editReply({
                content: `✅ **Stake Retirado!**\n\n💰 Principal: **${amount}**\n📈 Ganancias: **${earnings.toFixed(4)}**\n🎉 Total: **${(amount + earnings).toFixed(4)}**`
            });

        } catch (error) {
            await interaction.editReply(`❌ ${error.message}`);
        }
    }
}

else if (commandName === 'slots') {
    try {
        await interaction.deferReply();
    } catch (err) {
        console.error('[ERROR] Failed to defer slots:', err);
        return;
    }

    const apuesta = interaction.options.getInteger('apuesta');

    if (apuesta < 100) {
        return interaction.editReply('❌ Apuesta mínima: $100');
    }

    try {
        // Payment from debit card
        const card = await getDebitCard(interaction.user.id);
        if (!card || card.balance < apuesta) {
            return interaction.editReply('❌ Saldo insuficiente en tarjeta de débito');
        }

        await supabase
            .from('debit_cards')
            .update({ balance: card.balance - apuesta })
            .eq('id', card.id);

        // Spin!
        const { result, payout, win, jackpot, jackpotAmount } = await slotsService.spin(
            interaction.user.id,
            apuesta
        );

        // Pay winnings
        if (payout > 0) {
            await supabase
                .from('debit_cards')
                .update({ balance: card.balance - apuesta + payout })
                .eq('id', card.id);
        }

        // Build result message
        const spinning = '🎰 | 🎰 | 🎰';
        const final = `${result.reel1} | ${result.reel2} | ${result.reel3}`;

        let message = `**SLOT MACHINE** 🎰\n\n${spinning}\n⬇️\n${final}\n\n`;

        if (jackpot) {
            message += `🎉🎉🎉 **JACKPOT!!!** 🎉🎉🎉\n💰 ¡Ganaste $${jackpotAmount.toLocaleString()} del jackpot!\n`;
        } else if (win) {
            const profit = payout - apuesta;
            message += `✅ **¡GANASTE!** 💰\nPago: $${payout.toLocaleString()} (+$${profit.toLocaleString()})\n`;
        } else {
            message += `❌ **Perdiste** $${apuesta.toLocaleString()}\n`;
        }

        const currentJackpot = await slotsService.getJackpot();
        message += `\n🏆 Jackpot actual: $${currentJackpot.toLocaleString()}`;

        await interaction.editReply(message);

    } catch (error) {
        console.error(error);
        await interaction.editReply('❌ Error en slots');
    }
}

else if (commandName === 'fondos') {
    try {
        await interaction.deferReply();
    } catch (err) {
        console.error('[ERROR] Failed to defer fondos:', err);
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ver') {
        const { data: funds } = await supabase
            .from('investment_funds')
            .select('*')
            .eq('active', true)
            .order('apy');

        const embed = new EmbedBuilder()
            .setTitle('💼 Fondos de Inversión Disponibles')
            .setColor(0x00BFFF)
            .setFooter({ text: 'Usa /fondos invertir [fondo] [monto]' });

        funds.forEach(f => {
            embed.addFields({
                name: `${f.name} (${f.risk_level.toUpperCase()})`,
                value: `📊 APY: ${f.apy}%\n💰 Mín: $${f.min_investment.toLocaleString()}\n📝 ${f.description}`
            });
        });

        await interaction.editReply({ embeds: [embed] });
    }

    else if (subcommand === 'invertir') {
        const fondoNombre = interaction.options.getString('fondo');
        const monto = interaction.options.getInteger('monto');

        const { data: fund } = await supabase
            .from('investment_funds')
            .select('*')
            .ilike('name', `%${fondoNombre}%`)
            .single();

        if (!fund) {
            return interaction.editReply('❌ Fondo no encontrado. Usa `/fondos ver` para ver opciones.');
        }

        if (monto < fund.min_investment) {
            return interaction.editReply(`❌ Inversión mínima: $${fund.min_investment.toLocaleString()}`);
        }

        // Deduct from balance
        const card = await getDebitCard(interaction.user.id);
        if (!card || card.balance < monto) {
            return interaction.editReply('❌ Saldo insuficiente');
        }

        await supabase
            .from('debit_cards')
            .update({ balance: card.balance - monto })
            .eq('id', card.id);

        // Create investment
        await supabase
            .from('fund_investments')
            .insert({
                user_id: interaction.user.id,
                fund_id: fund.id,
                amount: monto,
                current_value: monto
            });

        await interaction.editReply({
            content: `✅ **Inversión Exitosa!**\n\n💼 Fondo: **${fund.name}**\n💰 Monto: **$${monto.toLocaleString()}**\n📊 APY: **${fund.apy}%**\n⏰ Tus ganancias se calculan diariamente.\n\n_Usa \`/fondos mis-fondos\` para ver tu portafolio._`
        });
    }

    else if (subcommand === 'mis-fondos') {
        const { data: investments } = await supabase
            .from('fund_investments')
            .select(`
                    *,
                    investment_funds (name, apy, risk_level)
                `)
            .eq('user_id', interaction.user.id)
            .eq('status', 'active');

        if (!investments || investments.length === 0) {
            return interaction.editReply('📊 No tienes inversiones activas. Usa `/fondos invertir`');
        }

        const embed = new EmbedBuilder()
            .setTitle('💼 Tus Inversiones')
            .setColor(0x00BFFF);

        investments.forEach(inv => {
            const fund = inv.investment_funds;
            embed.addFields({
                name: fund.name,
                value: `💰 Invertido: $${inv.amount.toLocaleString()}\n📊 APY: ${fund.apy}%\n📈 Nivel: ${fund.risk_level}`
            });
        });

        await interaction.editReply({ embeds: [embed] });
    }
}
