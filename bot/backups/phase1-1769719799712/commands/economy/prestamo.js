const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestamo')
        .setDescription('💰 Sistema de Préstamos Bancarios')
        .addSubcommand(sub => sub
            .setName('ver')
            .setDescription('Ver tus préstamos activos')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Ver préstamos de otro usuario (solo banqueros)')
                .setRequired(false)))
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
                )))
        .addSubcommand(sub => sub
            .setName('ayuda')
            .setDescription('Información sobre cómo solicitar un préstamo')),

    async execute(interaction, client, supabase) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'ver':
                return handleVer(interaction, supabase);
            case 'pagar':
                return handlePagar(interaction, supabase, client);
            case 'calcular':
                return handleCalcular(interaction);
            case 'ayuda':
                return handleAyuda(interaction);
        }
    }
};

async function handleAyuda(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('💰 Sistema de Préstamos - Información')
        .setDescription('El sistema de préstamos ahora funciona a través de **tickets bancarios** para un proceso más eficiente.')
        .addFields(
            {
                name: '📝 Cómo Solicitar un Préstamo',
                value: '1. Abre un **ticket de Préstamo** en el panel de tickets\n2. Completa los datos: monto, plazo y motivo\n3. Un banquero revisará tu solicitud\n4. El banquero puede **aprobar**, **modificar términos** o **rechazar**\n5. Si es aprobado, recibirás el dinero automáticamente',
                inline: false
            },
            {
                name: '💳 Comandos Disponibles',
                value: '• `/prestamo ver` - Ver tus préstamos activos\n• `/prestamo pagar` - Realizar un pago\n• `/prestamo calcular` - Calcular cuotas',
                inline: false
            },
            {
                name: '🔧 Modificación de Términos',
                value: 'Si tu solicitud tiene un monto o plazo irreal, el banquero puede ajustar los términos antes de aprobar. Recibirás una notificación con los cambios.',
                inline: false
            },
            {
                name: '📊 Tasas y Límites',
                value: '• **Tasa de interés:** 5% anual\n• **Monto mínimo:** $10,000\n• **Plazos disponibles:** 3, 6, 12, 24 meses\n• **Máximo de préstamos activos:** 2',
                inline: false
            }
        )
        .setColor(0x3498DB)
        .setFooter({ text: 'Abre un ticket de Préstamo para comenzar' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
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
