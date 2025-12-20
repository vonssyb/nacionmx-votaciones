// Command Handlers for 4 New Economy Systems
// Ready to integrate into bot/index.js

const StakingService = require('./services/StakingService');
const SlotsService = require('./services/SlotsService');

const stakingService = new StakingService(supabase);
const slotsService = new SlotsService(supabase);

// ===================================================================
// 1. /stake - Crypto Staking Commands
// ===================================================================

else if (commandName === 'stake') {
    await interaction.deferReply();
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
            // Deduct crypto from portfolio
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

            await interaction.editReply({
                content: `✅ **Staking Exitoso!**\n\n🔒 **${cantidad}** ${crypto} bloqueado por **${dias} días**\n📊 APY: **${apy.toFixed(1)}%**\n💰 Earnings estimados: **${(cantidad * rates[dias] * dias / 365).toFixed(4)}** ${crypto}\n\n_Usa \`/stake mis-stakes\` para ver todos tus stakes._`
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

        const embed = {
            title: '🔒 Tus Stakes Activos',
            color: 0x00FF00,
            fields: stakes.map(s => {
                const endDate = new Date(s.end_date);
                const isUnlocked = Date.now() > endDate.getTime();
                const status = isUnlocked ? '🔓 DESBLOQUEADO' : `🔒 Bloqueado hasta ${endDate.toLocaleDateString()}`;

                return {
                    name: `${s.crypto_symbol} - ${s.amount} unidades`,
                    value: `APY: ${s.apy}%\n${status}\nID: \`${s.id.substring(0, 8)}\``
                };
            }),
            footer: { text: 'Usa /stake retirar [id] para retirar stakes desbloqueados' }
        };

        await interaction.editReply({ embeds: [embed] });
    }

    else if (subcommand === 'retirar') {
        const stakeId = interaction.options.getString('id');

        try {
            const { amount, earnings } = await stakingService.withdrawStake(stakeId, interaction.user.id);

            // Return crypto + earnings to portfolio
            const { data: portfolio } = await supabase
                .from('stock_portfolios')
                .select('*')
                .eq('discord_user_id', interaction.user.id)
                .eq('stock_symbol', crypto)
                .single();

            if (portfolio) {
                await supabase
                    .from('stock_portfolios')
                    .update({ shares: portfolio.shares + amount + earnings })
                    .eq('id', portfolio.id);
            }

            await interaction.editReply({
                content: `✅ **Stake Retirado!**\n\n💰 Principal: **${amount}**\n📈 Ganancias: **${earnings.toFixed(4)}**\n🎉 Total: **${(amount + earnings).toFixed(4)}**`
            });

        } catch (error) {
            await interaction.editReply(`❌ ${error.message}`);
        }
    }
}

// ===================================================================
// 2. /slots - Slot Machine
// ===================================================================

else if (commandName === 'slots') {
    await interaction.deferReply();
    const apuesta = interaction.options.getInteger('apuesta');

    if (apuesta < 100) {
        return interaction.editReply('❌ Apuesta mínima: $100');
    }

    try {
        // Payment
        const card = await getDebitCard(interaction.user.id);
        if (!card || card.balance < apuesta) {
            return interaction.editReply('❌ Saldo insuficiente');
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

// ===================================================================
// 3. /fondos - Investment Funds
// ===================================================================

else if (commandName === 'fondos') {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ver') {
        const { data: funds } = await supabase
            .from('investment_funds')
            .select('*')
            .eq('active', true)
            .order('apy');

        const embed = {
            title: '💼 Fondos de Inversión Disponibles',
            color: 0x00BFFF,
            fields: funds.map(f => ({
                name: `${f.name} (${f.risk_level.toUpperCase()})`,
                value: `📊 APY: ${f.apy}%\n💰 Mín: $${f.min_investment.toLocaleString()}\n📝 ${f.description}`
            })),
            footer: { text: 'Usa /fondos invertir [fondo] [monto]' }
        };

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
            return interaction.editReply('❌ Fondo no encontrado');
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
}

// ===================================================================
// Registration (add to manual_register.js)
// ===================================================================

/*
new SlashCommandBuilder()
    .setName('stake')
    .setDescription('Staking de crypto para ingresos pasivos')
    .addSubcommand(sub => sub
        .setName('depositar')
        .setDescription('Stakear crypto')
        .addStringOption(opt => opt.setName('crypto').setDescription('BTC, ETH, SOL').setRequired(true))
        .addNumberOption(opt => opt.setName('cantidad').setDescription('Cantidad').setRequired(true))
        .addIntegerOption(opt => opt.setName('dias').setDescription('7, 30, o 90 días').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('mis-stakes').setDescription('Ver tus stakes'))
    .addSubcommand(sub => sub
        .setName('retirar')
        .setDescription('Retirar stake desbloqueado')
        .addStringOption(opt => opt.setName('id').setDescription('ID del stake').setRequired(true))
    ),

new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Jugar tragamonedas')
    .addIntegerOption(opt => opt
        .setName('apuesta')
        .setDescription('Cantidad a apostar')
        .setRequired(true)
        .setMinValue(100)
    ),

new SlashCommandBuilder()
    .setName('fondos')
    .setDescription('💼 Fondos de inversión')
    .addSubcommand(sub => sub.setName('ver').setDescription('Ver fondos disponibles'))
    .addSubcommand(sub => sub
        .setName('invertir')
        .setDescription('Invertir en un fondo')
        .addStringOption(opt => opt.setName('fondo').setDescription('Nombre del fondo').setRequired(true))
        .addIntegerOption(opt => opt.setName('monto').setDescription('Cantidad').setRequired(true))
    )
*/
