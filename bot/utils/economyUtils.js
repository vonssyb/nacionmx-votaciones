const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function getAvailablePaymentMethods(supabase, userId, guildId) {
    const methods = {
        cash: { available: true, label: '💵 Efectivo', value: 'cash' },
        debit: { available: false, label: '💳 Débito', value: 'debit', card: null },
        credit: { available: false, label: '🔖 Crédito', value: 'credit', card: null },
        businessCredit: { available: false, label: '🏢 Crédito Empresa', value: 'business_credit', card: null }
    };

    try {

        // Check debit card
        const { data: debitCard, error: debitError } = await supabase
            .from('debit_cards')
            .select('*')
            .eq('discord_user_id', userId)
            .eq('status', 'active')
            .maybeSingle();

        if (debitCard) {
            methods.debit.available = true;
            methods.debit.card = debitCard;
        }

        // Check personal credit card
        const { data: citizen, error: citError } = await supabase
            .from('citizens')
            .select('id')
            .eq('discord_id', userId)
            .maybeSingle();

        if (citizen) {
            const { data: creditCard, error: credError } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('citizen_id', citizen.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (creditCard) {
                // Check both columns because of legacy/migration state
                const limit = creditCard.card_limit || creditCard.credit_limit || 0;
                const balance = creditCard.current_balance || 0;
                const availableCredit = limit - balance;
                if (availableCredit > 0) {
                    methods.credit.available = true;
                    methods.credit.card = creditCard;
                    methods.credit.availableCredit = availableCredit;
                }
            }
        }

        // Check business credit (company + business credit card)
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('*')
            .contains('owner_ids', [userId]);

        if (companies && companies.length > 0) {
            // Check if company has business credit card
            const { data: businessCard, error: bizError } = await supabase
                .from('business_credit_cards')
                .select('*')
                .eq('company_id', companies[0].id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (businessCard) {
                methods.businessCredit.available = true;
                methods.businessCredit.card = businessCard;
                methods.businessCredit.company = companies[0];
            }
        }

    } catch (error) {
        console.error('[getAvailablePaymentMethods] Error:', error);
    }

    return methods;
}

function createPaymentReceipt(concept, amount, method, txId) {
    const methodIcons = {
        'cash': '💵 Efectivo',
        'debit': '🏦 Banco (Débito)',
        'credit': '💳 Crédito Personal',
        'business': '🏢 Crédito Empresa'
    };

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Pago Exitoso')
        .addFields(
            { name: '🧾 Concepto', value: concept, inline: false },
            { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
            { name: '💳 Método', value: methodIcons[method] || method, inline: true },
            { name: '🔖 ID Transacción', value: `\`${txId}\``, inline: false }
        )
        .setFooter({ text: 'Nación MX - Sistema de Pagos' })
        .setTimestamp();

    return embed;
}

function createPaymentButtons(availableMethods, prefix = 'pay') {
    const buttons = [];

    if (availableMethods.cash.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_cash`)
            .setLabel(availableMethods.cash.label)
            .setStyle(ButtonStyle.Primary));
    }

    if (availableMethods.debit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_debit`)
            .setLabel(availableMethods.debit.label)
            .setStyle(ButtonStyle.Success));
    }

    if (availableMethods.credit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_credit`)
            .setLabel(availableMethods.credit.label)
            .setStyle(ButtonStyle.Danger));
    }

    if (availableMethods.businessCredit.available) {
        buttons.push(new ButtonBuilder()
            .setCustomId(`${prefix}_business`)
            .setLabel(availableMethods.businessCredit.label)
            .setStyle(ButtonStyle.Secondary));
    }

    return new ActionRowBuilder().addComponents(buttons);
}

// Create rich payment embed with transaction details
function createPaymentEmbed(concept, amount, availableMethods) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 Confirmar Pago')
        .setDescription(`**${concept}**\n\n💵 **Total:** $${amount.toLocaleString()}`)
        .addFields(
            { name: '📊 Métodos Disponibles', value: getAvailableMethodsText(availableMethods), inline: false }
        )
        .setFooter({ text: 'Selecciona tu método de pago preferido ⬇️' })
        .setTimestamp();

    return embed;
}

function getAvailableMethodsText(methods) {
    const available = [];
    if (methods.cash.available) available.push('💵 **Efectivo** - Pago inmediato');
    if (methods.debit.available) available.push('🏦 **Banco (Débito)** - Desde tu cuenta');
    if (methods.credit.available) {
        const credit = methods.credit.availableCredit || 0;
        available.push(`💳 **Crédito Personal** - Disponible: $${credit.toLocaleString()}`);
    }
    if (methods.businessCredit.available) {
        const bizCredit = methods.businessCredit.card;
        const available = bizCredit ? (bizCredit.credit_limit - bizCredit.current_balance) : 0;
        available.push(`🏢 **Crédito Empresa** - Disponible: $${available.toLocaleString()}`);
    }

    return available.join('\n') || '❌ No hay métodos de pago disponibles';
}


async function processPayment(billingService, supabase, method, userId, guildId, amount, description, availableMethods) {
    try {
        if (method === 'cash') {
            const balance = await billingService.ubService.getUserBalance(guildId, userId);
            if ((balance.cash || 0) < amount) {
                return { success: false, error: `❌ Efectivo insuficiente.\nNecesitas: $${amount.toLocaleString()}\nTienes: $${(balance.cash || 0).toLocaleString()}` };
            }
            await billingService.ubService.removeMoney(guildId, userId, amount, description, 'cash');
            return { success: true, method: '💵 Efectivo', source: 'cash' };
        }

        if (method === 'debit') {
            if (!availableMethods.debit.available) {
                return { success: false, error: '❌ No tienes tarjeta de débito activa.' };
            }
            const balance = await billingService.ubService.getUserBalance(guildId, userId);
            if ((balance.bank || 0) < amount) {
                return { success: false, error: `❌ Saldo bancario insuficiente.\nNecesitas: $${amount.toLocaleString()}\nTienes: $${(balance.bank || 0).toLocaleString()}` };
            }
            await billingService.ubService.removeMoney(guildId, userId, amount, description, 'bank');
            return { success: true, method: '💳 Débito', source: 'bank' };
        }

        if (method === 'credit') {
            if (!availableMethods.credit.available || !availableMethods.credit.card) {
                return { success: false, error: '❌ No tienes tarjeta de crédito.' };
            }
            const creditCard = availableMethods.credit.card;
            const available = (creditCard.card_limit || creditCard.credit_limit || 0) - (creditCard.current_balance || 0);
            if (available < amount) {
                return { success: false, error: `❌ Crédito insuficiente.\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}` };
            }
            await supabase.from('credit_cards').update({
                current_balance: creditCard.current_balance + amount
            }).eq('id', creditCard.id);
            return { success: true, method: '🔖 Crédito', source: 'credit' };
        }

        if (method === 'business') {
            if (!availableMethods.businessCredit.available || !availableMethods.businessCredit.card) {
                return { success: false, error: '❌ No tienes crédito empresarial disponible.' };
            }
            const businessCard = availableMethods.businessCredit.card;
            const available = (businessCard.credit_limit || businessCard.card_limit || 0) - (businessCard.current_balance || 0);
            if (available < amount) {
                return { success: false, error: `❌ Crédito empresarial insuficiente.\nDisponible: $${available.toLocaleString()}\nNecesitas: $${amount.toLocaleString()}` };
            }
            await supabase.from('business_credit_cards').update({
                current_balance: businessCard.current_balance + amount
            }).eq('id', businessCard.id);
            return { success: true, method: '🏢 Crédito Empresa', source: 'business_credit' };
        }
    } catch (error) {
        console.error('[processPayment] Error:', error);
        return { success: false, error: `❌ Error de proceso: ${error.message}` };
    }
    return { success: false, error: '❌ Método de pago inválido.' };
}

module.exports = {
    getAvailablePaymentMethods,
    createPaymentReceipt,
    createPaymentButtons,
    createPaymentEmbed,
    getAvailableMethodsText,
    processPayment
};
