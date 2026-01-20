const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestamo')
        .setDescription('💰 Sistema de Préstamos Bancarios')
        .addSubcommand(sub => sub
            .setName('solicitar')
            .setDescription('Solicitar un préstamo personal')
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a solicitar (mínimo 10,000)')
                .setRequired(true)
                .setMinValue(10000))
            .addIntegerOption(opt => opt
                .setName('plazo')
                .setDescription('Plazo en meses (3, 6, 12, 24)')
                .setRequired(true)
                .addChoices(
                    { name: '3 meses', value: 3 },
                    { name: '6 meses', value: 6 },
                    { name: '12 meses', value: 12 },
                    { name: '24 meses', value: 24 }
                ))
            .addStringOption(opt => opt
                .setName('motivo')
                .setDescription('Motivo del préstamo')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('pagar')
            .setDescription('Realizar un pago a tu préstamo')
            .addIntegerOption(opt => opt
                .setName('prestamo_id')
                .setDescription('ID del préstamo')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto a pagar (vacío = pago completo)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tus préstamos activos')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Ver préstamos de otro usuario (solo banqueros)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('aprobar')
            .setDescription('Aprobar un préstamo solicitado (solo banqueros)')
            .addIntegerOption(opt => opt
                .setName('prestamo_id')
                .setDescription('ID del préstamo a aprobar')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('calcular')
            .setDescription('Calcular cuotas de un préstamo')
            .addIntegerOption(opt => opt
                .setName('monto')
                .setDescription('Monto del préstamo')
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
            case 'solicitar':
                return handleSolicitar(interaction, supabase);
            case 'pagar':
                return handlePagar(interaction, supabase, client);
            case 'ver':
                return handleVer(interaction, supabase);
            case 'aprobar':
                return handleAprobar(interaction, supabase, client);
            case 'calcular':
                return handleCalcular(interaction);
        }
    }
};

async function handleSolicitar(interaction, supabase) {
    await interaction.deferReply({ ephemeral: true });

    const monto = interaction.options.getInteger('monto');
    const plazo = interaction.options.getInteger('plazo');
    const motivo = interaction.options.getString('motivo');

    // Check if user already has active loans
    const { data: existingLoans } = await supabase
        .from('loans')
        .select('*')
        .eq('discord_user_id', interaction.user.id)
        .eq('status', 'active');

    if (existingLoans && existingLoans.length >= 2) {
        return interaction.editReply('❌ Ya tienes el máximo de préstamos activos permitidos (2).');
    }

    // Calculate loan details
    const interestRate = 5.00; // 5% anual
    const monthlyInterestRate = (interestRate / 100) / 12;
    const monthlyPayment = Math.ceil((monto * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, plazo)) / (Math.pow(1 + monthlyInterestRate, plazo) - 1));
    const totalToPay = monthlyPayment * plazo;
    const totalInterest = totalToPay - monto;

    // Create loan request (pending approval)
    const { data: loan, error } = await supabase
        .from('loans')
        .insert({
            guild_id: interaction.guildId,
            discord_user_id: interaction.user.id,
            loan_amount: monto,
            interest_rate: interestRate,
            term_months: plazo,
            monthly_payment: monthlyPayment,
            total_to_pay: totalToPay,
            purpose: motivo,
            status: 'pending',
            next_payment_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[Prestamo] Error:', error);
        return interaction.editReply('❌ Error al solicitar el préstamo.');
    }

    const embed = new EmbedBuilder()
        .setTitle('📋 Solicitud de Préstamo Enviada')
        .setDescription('Tu solicitud ha sido enviada a revisión bancaria.')
        .addFields(
            { name: '💰 Monto Solicitado', value: `$${monto.toLocaleString()}`, inline: true },
            { name: '📅 Plazo', value: `${plazo} meses`, inline: true },
            { name: '📊 Tasa de Interés', value: `${interestRate}% anual`, inline: true },
            { name: '💳 Pago Mensual', value: `$${monthlyPayment.toLocaleString()}`, inline: true },
            { name: '💵 Total a Pagar', value: `$${totalToPay.toLocaleString()}`, inline: true },
            { name: '📈 Intereses', value: `$${totalInterest.toLocaleString()}`, inline: true },
            { name: '📄 Motivo', value: motivo, inline: false },
            { name: '🆔 ID Solicitud', value: `#${loan.id}`, inline: false }
        )
        .setColor(0xFFA500)
        .setFooter({ text: 'Un banquero revisará tu solicitud pronto' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handlePagar(interaction, supabase, client) {
    await interaction.deferReply({ ephemeral: true });

    const loanId = interaction.options.getInteger('prestamo_id');
    const monto = interaction.options.getInteger('monto');

    const { data: loan } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .eq('discord_user_id', interaction.user.id)
        .eq('status', 'active')
        .single();

    if (!loan) {
        return interaction.editReply('❌ No se encontró ese préstamo activo.');
    }

    const remaining = loan.total_to_pay - loan.amount_paid;
    const paymentAmount = monto || remaining;

    if (paymentAmount > remaining) {
        return interaction.editReply(`❌ El monto excede lo que debes ($${remaining.toLocaleString()}).`);
    }

    // Check user's balance
    const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);

    const balance = await ubService.getBalance(interaction.guildId, interaction.user.id);

    if (!balance || balance.cash < paymentAmount) {
        return interaction.editReply(`❌ No tienes suficiente dinero en efectivo. Necesitas $${paymentAmount.toLocaleString()}.`);
    }

    // Process payment
    await ubService.removeMoney(interaction.guildId, interaction.user.id, paymentAmount, `Pago de préstamo #${loanId}`, 'cash');

    const newAmountPaid = loan.amount_paid + paymentAmount;
    const newPaymentsMade = loan.payments_made + 1;
    const isPaidOff = newAmountPaid >= loan.total_to_pay;

    await supabase
        .from('loans')
        .update({
            amount_paid: newAmountPaid,
            payments_made: newPaymentsMade,
            status: isPaidOff ? 'paid' : 'active',
            completed_at: isPaidOff ? new Date().toISOString() : null
        })
        .eq('id', loanId);

    // Record payment
    await supabase
        .from('loan_payments')
        .insert({
            loan_id: loanId,
            payment_amount: paymentAmount,
            payment_type: isPaidOff ? 'final' : 'regular',
            paid_by: interaction.user.id
        });

    const embed = new EmbedBuilder()
        .setTitle(isPaidOff ? '✅ Préstamo Liquidado' : '✅ Pago Registrado')
        .setDescription(isPaidOff ? '¡Felicidades! Has pagado tu préstamo completamente.' : 'Tu pago ha sido procesado exitosamente.')
        .addFields(
            { name: '💰 Monto Pagado', value: `$${paymentAmount.toLocaleString()}`, inline: true },
            { name: '📊 Total Pagado', value: `$${newAmountPaid.toLocaleString()}`, inline: true },
            { name: '💵 Restante', value: `$${(loan.total_to_pay - newAmountPaid).toLocaleString()}`, inline: true }
        )
        .setColor(isPaidOff ? 0x00FF00 : 0x5865F2)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleVer(interaction, supabase) {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('usuario') || interaction.user;

    // Check permissions if viewing another user
    if (targetUser.id !== interaction.user.id) {
        const BANKER_ROLES = ['1450591546524307689', '1412882245735420006'];
        const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isBanker) {
            return interaction.editReply('❌ Solo los banqueros pueden ver préstamos de otros usuarios.');
        }
    }

    const { data: loans } = await supabase
        .from('loans')
        .select('*')
        .eq('discord_user_id', targetUser.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

    if (!loans || loans.length === 0) {
        return interaction.editReply(`📭 ${targetUser.id === interaction.user.id ? 'No tienes' : `${targetUser.tag} no tiene`} préstamos activos.`);
    }

    const embed = new EmbedBuilder()
        .setTitle(`💰 Préstamos de ${targetUser.tag}`)
        .setColor(0x5865F2)
        .setTimestamp();

    loans.forEach((loan, index) => {
        const remaining = loan.total_to_pay - loan.amount_paid;
        const progress = ((loan.amount_paid / loan.total_to_pay) * 100).toFixed(1);

        embed.addFields({
            name: `${index + 1}. Préstamo #${loan.id} - ${loan.status === 'pending' ? '⏳ Pendiente' : '🟢 Activo'}`,
            value: `💰 **Monto:** $${loan.loan_amount.toLocaleString()}\n` +
                `💳 **Pago Mensual:** $${loan.monthly_payment.toLocaleString()}\n` +
                `📊 **Progreso:** ${progress}% (${loan.payments_made}/${loan.term_months} pagos)\n` +
                `💵 **Restante:** $${remaining.toLocaleString()}\n` +
                `📄 **Motivo:** ${loan.purpose}`,
            inline: false
        });
    });

    await interaction.editReply({ embeds: [embed] });
}

async function handleAprobar(interaction, supabase, client) {
    // Only bankers
    const BANKER_ROLES = ['1450591546524307689', '1412882245735420006'];
    const isBanker = interaction.member.roles.cache.some(r => BANKER_ROLES.includes(r.id)) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isBanker) {
        return interaction.reply({ content: '❌ Solo banqueros pueden aprobar préstamos.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const loanId = interaction.options.getInteger('prestamo_id');

    const { data: loan } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .eq('status', 'pending')
        .single();

    if (!loan) {
        return interaction.editReply('❌ No se encontró ese préstamo pendiente.');
    }

    // Approve and disburse
    await supabase
        .from('loans')
        .update({
            status: 'active',
            approved_by: interaction.user.id,
            approved_at: new Date().toISOString()
        })
        .eq('id', loanId);

    // Give money to user
    const UnbelievaBoatService = require('../../services/UnbelievaBoatService');
    const ubService = new UnbelievaBoatService(process.env.UNBELIEVABOAT_TOKEN, supabase);
    await ubService.addMoney(interaction.guildId, loan.discord_user_id, loan.loan_amount, `Préstamo #${loanId} aprobado`, 'cash');

    // Notify user
    try {
        const user = await client.users.fetch(loan.discord_user_id);
        await user.send(`✅ **Préstamo Aprobado**\n\nTu solicitud de préstamo #${loanId} por $${loan.loan_amount.toLocaleString()} ha sido aprobada.\n\n💳 **Pago mensual:** $${loan.monthly_payment.toLocaleString()}\n📅 **Plazo:** ${loan.term_months} meses\n\nEl dinero ha sido depositado en tu cuenta.`);
    } catch (e) {
        console.log('[Loan] Could not DM user');
    }

    await interaction.editReply(`✅ Préstamo #${loanId} aprobado y desembolsado.`);
}

async function handleCalcular(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const monto = interaction.options.getInteger('monto');
    const plazo = interaction.options.getInteger('plazo');
    const interestRate = 5.00;

    const monthlyInterestRate = (interestRate / 100) / 12;
    const monthlyPayment = Math.ceil((monto * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, plazo)) / (Math.pow(1 + monthlyInterestRate, plazo) - 1));
    const totalToPay = monthlyPayment * plazo;
    const totalInterest = totalToPay - monto;

    const embed = new EmbedBuilder()
        .setTitle('🧮 Calculadora de Préstamos')
        .addFields(
            { name: '💰 Monto', value: `$${monto.toLocaleString()}`, inline: true },
            { name: '📅 Plazo', value: `${plazo} meses`, inline: true },
            { name: '📊 Tasa', value: `${interestRate}%`, inline: true },
            { name: '💳 Pago Mensual', value: `$${monthlyPayment.toLocaleString()}`, inline: true },
            { name: '💵 Total a Pagar', value: `$${totalToPay.toLocaleString()}`, inline: true },
            { name: '📈 Intereses', value: `$${totalInterest.toLocaleString()}`, inline: true }
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'Usa /prestamo solicitar para pedir un préstamo' });

    await interaction.editReply({ embeds: [embed] });
}
