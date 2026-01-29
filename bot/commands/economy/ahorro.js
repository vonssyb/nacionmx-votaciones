const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function generateAccountNumber() {
    return '4' + Math.floor(Math.random() * 1000000000000000).toString().padStart(15, '0');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ahorro')
        .setDescription('💵 Sistema de Cuentas de Ahorro')
        .addSubcommand(sub => sub
            .setName('abrir')
            .setDescription('Abrir una cuenta de ahorro')
            .addIntegerOption(opt => opt
                .setName('deposito')
                .setDescription('Depósito inicial (mínimo 5,000)')
                .setRequired(true)
                .setMinValue(5000))
            .addIntegerOption(opt => opt
                .setName('plazo')
                .setDescription('Plazo del ahorro en meses')
                .setRequired(true)
                .addChoices(
                    { name: '3 meses (3% anual)', value: 3 },
                    { name: '6 meses (4% anual)', value: 6 },
                    { name: '12 meses (5% anual)', value: 12 },
                    { name: '24 meses (6% anual)', value: 24 }
                )))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tus cuentas de ahorro')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Ver cuentas de otro usuario (solo banqueros)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('depositar')
            .setDescription('Depositar dinero en tu cuenta de ahorro')
            .addStringOption(opt => opt
                .setName('cuenta')
                .setDescription('Número de cuenta')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a depositar')
                .setRequired(true)
                .setMinValue(100)))
        .addSubcommand(sub => sub
            .setName('retirar')
            .setDescription('Retirar dinero de tu cuenta de ahorro')
            .addStringOption(opt => opt
                .setName('cuenta')
                .setDescription('Número de cuenta')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a retirar (vacío = saldo total)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('cerrar')
            .setDescription('Cerrar una cuenta de ahorro')
            .addStringOption(opt => opt
                .setName('cuenta')
                .setDescription('Número de cuenta a cerrar')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('calcular')
            .setDescription('Calcular rendimiento de un ahorro')
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a ahorrar')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('plazo')
                .setDescription('Plazo en meses')
                .setRequired(true)
                .addChoices(
                    { name: '3 meses', value: 3 },
                    { name: '6 meses', value: 6 },
                    { name: '12 meses', value: 12 },
                    { name: '24 meses', value: 24 }
                ))),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'abrir':
                return handleAbrir(interaction, supabase, client);
            case 'ver':
                return handleVer(interaction, supabase);
            case 'depositar':
                return handleDepositar(interaction, supabase, client);
            case 'retirar':
                return handleRetirar(interaction, supabase, client);
            case 'cerrar':
                return handleCerrar(interaction, supabase, client);
            case 'calcular':
                return handleCalcular(interaction);
        }
    }
};

function getInterestRate(months) {
    const rates = { 3: 3.00, 6: 4.00, 12: 5.00, 24: 6.00 };
    return rates[months] || 3.00;
}

async function handleAbrir(interaction, supabase, client) {
    await interaction.deferReply({ ephemeral: true });

    const deposito = interaction.options.getInteger('deposito');
    const plazo = interaction.options.getInteger('plazo');
    const targetUser = interaction.options.getUser('cliente') || interaction.user;

    // Permissions check for Bankers operating on others
    if (targetUser.id !== interaction.user.id) {
        const BANKER_ROLES = ['1450591546524307689', '1412882245735420006'];
        const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isBanker) return interaction.editReply('❌ Solo banqueros pueden abrir cuentas para otros.');
    }

    // Check if user has money (Check TARGET USER balance)
    const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);

    const balance = await ubService.getBalance(interaction.guildId, targetUser.id);

    if (!balance || balance.cash < deposito) {
        return interaction.editReply(`❌ ${targetUser.username} no tiene suficiente dinero en efectivo. Necesita $${deposito.toLocaleString()}.`);
    }

    // Check max accounts
    const { data: existing } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('discord_user_id', targetUser.id)
        .eq('status', 'active');

    if (existing && existing.length >= 3) {
        return interaction.editReply('❌ El usuario ya tiene el máximo de cuentas de ahorro permitidas (3).');
    }

    // Calculate maturity
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + plazo);

    const interestRate = getInterestRate(plazo);
    const accountNumber = generateAccountNumber();

    // Deduct money from TARGET
    try {
        await ubService.removeMoney(interaction.guildId, targetUser.id, deposito, `Apertura cuenta ahorro ${accountNumber}`, 'cash');
    } catch (e) {
        return interaction.editReply('❌ Error al procesar el cobro en UnbelievaBoat.');
    }

    // Create account
    const { data: account, error } = await supabase
        .from('savings_accounts')
        .insert({
            guild_id: interaction.guildId,
            discord_user_id: targetUser.id,
            account_number: accountNumber,
            initial_deposit: deposito,
            current_balance: deposito,
            interest_rate: interestRate,
            term_months: plazo,
            opened_by: interaction.user.id,
            maturity_date: maturityDate.toISOString()
        })
        .select()
        .maybeSingle();

    if (error) {
        console.error('[Ahorro] Error:', error);
        // Refund
        await ubService.addMoney(interaction.guildId, interaction.user.id, deposito, 'Reembolso cuenta ahorro fallida', 'cash');
        return interaction.editReply('❌ Error al abrir la cuenta de ahorro.');
    }

    // Record transaction
    await supabase
        .from('savings_transactions')
        .insert({
            account_id: account.id,
            transaction_type: 'deposit',
            amount: deposito,
            balance_after: deposito,
            executed_by: interaction.user.id,
            notes: 'Depósito inicial'
        });

    const embed = new EmbedBuilder()
        .setTitle('💵 Cuenta de Ahorro Abierta')
        .setDescription('¡Tu cuenta de ahorro ha sido creada exitosamente!')
        .addFields(
            { name: '🔢 Número de Cuenta', value: `\`${accountNumber}\``, inline: false },
            { name: '💰 Depósito Inicial', value: `$${deposito.toLocaleString()}`, inline: true },
            { name: '📅 Plazo', value: `${plazo} meses`, inline: true },
            { name: '📊 Tasa de Interés', value: `${interestRate}% anual`, inline: true },
            { name: '📆 Fecha de Vencimiento', value: `<t:${Math.floor(maturityDate.getTime() / 1000)}:D>`, inline: false },
            { name: '💡 Rendimiento Estimado', value: `$${Math.floor(deposito * (interestRate / 100) * (plazo / 12)).toLocaleString()}`, inline: true }
        )
        .setColor(0x2ECC71)
        .setFooter({ text: 'El retiro anticipado tiene una penalización del 10%' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleVer(interaction, supabase) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('usuario') || interaction.user;

    // Check permissions
    if (targetUser.id !== interaction.user.id) {
        const BANKER_ROLES = ['1450591546524307689', '1412882245735420006'];
        const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isBanker) {
            return interaction.editReply('❌ Solo los banqueros pueden ver cuentas de otros usuarios.');
        }
    }

    const { data: accounts } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('discord_user_id', targetUser.id)
        .eq('status', 'active')
        .order('opened_at', { ascending: false });

    if (!accounts || accounts.length === 0) {
        return interaction.editReply(`📭 ${targetUser.id === interaction.user.id ? 'No tienes' : `${targetUser.tag} no tiene`} cuentas de ahorro activas.`);
    }

    const embed = new EmbedBuilder()
        .setTitle(`💵 Cuentas de Ahorro de ${targetUser.tag}`)
        .setColor(0x2ECC71)
        .setTimestamp();

    accounts.forEach((acc, index) => {
        const maturityDate = new Date(acc.maturity_date);
        const now = new Date();
        const isMatured = now >= maturityDate;
        const daysRemaining = Math.ceil((maturityDate - now) / (1000 * 60 * 60 * 24));

        embed.addFields({
            name: `${index + 1}. Cuenta ${acc.account_number} ${isMatured ? '✅ Vencida' : '⏱️ Activa'}`,
            value: `💰 **Saldo:** $${acc.current_balance.toLocaleString()}\n` +
                `📊 **Tasa:** ${acc.interest_rate}% anual\n` +
                `📅 **Plazo:** ${acc.term_months} meses\n` +
                `📆 **Vencimiento:** ${isMatured ? 'Disponible para retiro' : `En ${daysRemaining} días`}\n` +
                `💵 **Depósito Inicial:** $${acc.initial_deposit.toLocaleString()}`,
            inline: false
        });
    });

    await interaction.editReply({ embeds: [embed] });
}

async function handleDepositar(interaction, supabase, client) {
    await interaction.deferReply({ ephemeral: true });

    const accountNumber = interaction.options.getString('cuenta');
    const monto = interaction.options.getInteger('monto');

    const { data: account } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('account_number', accountNumber)
        .eq('discord_user_id', interaction.user.id)
        .eq('status', 'active')
        .maybeSingle();

    if (!account) {
        return interaction.editReply('❌ No se encontró esa cuenta de ahorro.');
    }

    // Check balance
    const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);

    const balance = await ubService.getBalance(interaction.guildId, interaction.user.id);

    if (!balance || balance.cash < monto) {
        return interaction.editReply(`❌ No tienes suficiente dinero.`);
    }

    // Process deposit
    await ubService.removeMoney(interaction.guildId, interaction.user.id, monto, `Depósito a cuenta ${accountNumber}`, 'cash');

    const newBalance = account.current_balance + monto;

    await supabase
        .from('savings_accounts')
        .update({ current_balance: newBalance })
        .eq('id', account.id);

    await supabase
        .from('savings_transactions')
        .insert({
            account_id: account.id,
            transaction_type: 'deposit',
            amount: monto,
            balance_after: newBalance,
            executed_by: interaction.user.id
        });

    await interaction.editReply(`✅ Depósito exitoso de $${monto.toLocaleString()}.\nNuevo saldo: $${newBalance.toLocaleString()}`);
}

async function handleRetirar(interaction, supabase, client) {
    await interaction.deferReply({ ephemeral: true });

    const accountNumber = interaction.options.getString('cuenta');
    const monto = interaction.options.getInteger('monto');

    const { data: account } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('account_number', accountNumber)
        .eq('discord_user_id', interaction.user.id)
        .eq('status', 'active')
        .maybeSingle();

    if (!account) {
        return interaction.editReply('❌ No se encontró esa cuenta de ahorro.');
    }

    const withdrawAmount = monto || account.current_balance;

    if (withdrawAmount > account.current_balance) {
        return interaction.editReply('❌ No hay suficiente saldo en la cuenta.');
    }

    // Check if matured
    const maturityDate = new Date(account.maturity_date);
    const now = new Date();
    const isMatured = now >= maturityDate;

    let penalty = 0;
    let finalAmount = withdrawAmount;

    if (!isMatured) {
        penalty = Math.floor(withdrawAmount * (account.withdrawal_penalty / 100));
        finalAmount = withdrawAmount - penalty;
    }

    // Process withdrawal
    const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
    await ubService.addMoney(interaction.guildId, interaction.user.id, finalAmount, `Retiro cuenta ${accountNumber}`, 'cash');

    const newBalance = account.current_balance - withdrawAmount;

    await supabase
        .from('savings_accounts')
        .update({ current_balance: newBalance })
        .eq('id', account.id);

    await supabase
        .from('savings_transactions')
        .insert({
            account_id: account.id,
            transaction_type: 'withdrawal',
            amount: withdrawAmount,
            balance_after: newBalance,
            executed_by: interaction.user.id,
            notes: penalty > 0 ? `Retiro anticipado - Penalización: $${penalty.toLocaleString()}` : null
        });

    if (penalty > 0) {
        await supabase
            .from('savings_transactions')
            .insert({
                account_id: account.id,
                transaction_type: 'penalty',
                amount: penalty,
                balance_after: newBalance,
                executed_by: 'SYSTEM',
                notes: 'Penalización por retiro anticipado'
            });
    }

    const embed = new EmbedBuilder()
        .setTitle('💵 Retiro Procesado')
        .addFields(
            { name: '💰 Monto Retirado', value: `$${withdrawAmount.toLocaleString()}`, inline: true },
            { name: penalty > 0 ? '⚠️ Penalización' : '✅ Sin penalización', value: penalty > 0 ? `$${penalty.toLocaleString()}` : 'Cuenta vencida', inline: true },
            { name: '💵 Recibido', value: `$${finalAmount.toLocaleString()}`, inline: true },
            { name: '📊 Saldo Restante', value: `$${newBalance.toLocaleString()}`, inline: false }
        )
        .setColor(penalty > 0 ? 0xFFA500 : 0x2ECC71)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleCerrar(interaction, supabase, client) {
    await interaction.deferReply({ ephemeral: true });

    const accountNumber = interaction.options.getString('cuenta');

    const { data: account } = await supabase
        .from('savings_accounts')
        .select('*')
        .eq('account_number', accountNumber)
        .eq('discord_user_id', interaction.user.id)
        .eq('status', 'active')
        .maybeSingle();

    if (!account) {
        return interaction.editReply('❌ No se encontró esa cuenta de ahorro.');
    }

    if (account.current_balance > 0) {
        return interaction.editReply('❌ Debes retirar todo el saldo antes de cerrar la cuenta.');
    }

    await supabase
        .from('savings_accounts')
        .update({
            status: 'closed',
            closed_at: new Date().toISOString()
        })
        .eq('id', account.id);

    await interaction.editReply(`✅ Cuenta ${accountNumber} cerrada exitosamente.`);
}

async function handleCalcular(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const monto = interaction.options.getInteger('monto');
    const plazo = interaction.options.getInteger('plazo');
    const interestRate = getInterestRate(plazo);

    const interest = Math.floor(monto * (interestRate / 100) * (plazo / 12));
    const total = monto + interest;

    const embed = new EmbedBuilder()
        .setTitle('🧮 Calculadora de Ahorro')
        .addFields(
            { name: '💰 Monto Inicial', value: `$${monto.toLocaleString()}`, inline: true },
            { name: '📅 Plazo', value: `${plazo} meses`, inline: true },
            { name: '📊 Tasa', value: `${interestRate}%`, inline: true },
            { name: '📈 Intereses Generados', value: `$${interest.toLocaleString()}`, inline: true },
            { name: '💵 Total al Vencimiento', value: `$${total.toLocaleString()}`, inline: true }
        )
        .setColor(0x2ECC71)
        .setFooter({ text: 'Usa /ahorro abrir para crear una cuenta' });

    await interaction.editReply({ embeds: [embed] });
}
