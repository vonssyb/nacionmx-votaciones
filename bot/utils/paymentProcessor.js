/**
 * Centralized Payment Processor
 * Handles all payment logic (cash, debit, credit) in one place
 * Eliminates the 87+ duplicated payment code blocks
 */

const ErrorHandler = require('./errorHandler');
const logger = require('../services/Logger');

class PaymentProcessor {
    constructor(supabase, billingService) {
        this.supabase = supabase;
        this.billingService = billingService;
    }

    /**
     * Get available payment methods for a user
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Payment amount
     * @returns {Object} Available methods with details
     */
    async getAvailablePaymentMethods(userId, guildId, amount = 0) {
        try {
            const methods = {
                cash: { available: false, balance: 0, label: '💵 Efectivo' },
                debit: { available: false, balance: 0, label: '💳 Débito', cardTier: null },
                credit: { available: false, balance: 0, label: '💳 Crédito', cardType: null, limit: 0 }
            };

            // Check cash (UnbelievaBoat)
            const ubBalance = await this.billingService.ubService.getUserBalance(guildId, userId);
            methods.cash.balance = ubBalance.cash || 0;
            methods.cash.available = methods.cash.balance >= amount;

            // Check debit card
            const { data: debitCard } = await this.supabase
                .from('debit_cards')
                .select('*')
                .eq('discord_user_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            if (debitCard) {
                methods.debit.available = ubBalance.bank >= amount;
                methods.debit.balance = ubBalance.bank || 0;
                methods.debit.cardTier = debitCard.card_tier;
            }

            // Check credit card
            const { data: creditCards } = await this.supabase
                .from('credit_cards')
                .select('*')
                .eq('discord_id', userId)
                .eq('status', 'active')
                .order('card_limit', { ascending: false })
                .limit(1);

            if (creditCards && creditCards.length > 0) {
                const card = creditCards[0];
                const available = card.card_limit - (card.current_balance || 0);
                methods.credit.available = available >= amount;
                methods.credit.balance = available;
                methods.credit.cardType = card.card_type;
                methods.credit.limit = card.card_limit;
                methods.credit.cardId = card.id;
            }

            return methods;
        } catch (error) {
            logger.errorWithContext('Failed to get payment methods', error, { userId, amount });
            throw ErrorHandler.createError('PAYMENT_FAILED', 'No se pudieron obtener los métodos de pago');
        }
    }

    /**
     * Process a payment
     * @param {string} method - Payment method (cash, debit, credit)
     * @param {string} userId - Discord user ID
     * @param {string} guildId - Guild ID
     * @param {number} amount - Amount to charge
     * @param {string} reason - Payment reason/description
     * @returns {Object} Payment result
     */
    async processPayment(method, userId, guildId, amount, reason) {
        try {
            // Validate amount
            if (!amount || amount <= 0) {
                throw ErrorHandler.createError('INVALID_AMOUNT', 'El monto debe ser mayor a 0');
            }

            // Get available methods
            const methods = await this.getAvailablePaymentMethods(userId, guildId, amount);

            // Validate method exists and is available
            if (!methods[method]) {
                throw ErrorHandler.createError('INVALID_PAYMENT_METHOD', `Método de pago "${method}" no válido`);
            }

            if (!methods[method].available) {
                throw ErrorHandler.createError('INSUFFICIENT_FUNDS',
                    `Fondos insuficientes en ${methods[method].label}\n` +
                    `Necesitas: $${amount.toLocaleString()}\n` +
                    `Tienes: $${methods[method].balance.toLocaleString()}`
                );
            }

            // Process payment based on method
            let result = {};

            switch (method) {
                case 'cash':
                    await this.billingService.ubService.removeMoney(guildId, userId, amount, reason, 'cash');
                    result = {
                        success: true,
                        method: '💵 Efectivo',
                        methodKey: 'cash',
                        amount,
                        remaining: methods.cash.balance - amount
                    };
                    break;

                case 'debit':
                    await this.billingService.ubService.removeMoney(guildId, userId, amount, reason, 'bank');
                    result = {
                        success: true,
                        method: `💳 Débito (${methods.debit.cardTier})`,
                        methodKey: 'debit',
                        amount,
                        remaining: methods.debit.balance - amount
                    };
                    break;

                case 'credit':
                    const { error } = await this.supabase
                        .from('credit_cards')
                        .update({
                            current_balance: (methods.credit.limit - methods.credit.balance) + amount,
                            last_transaction_at: new Date().toISOString()
                        })
                        .eq('id', methods.credit.cardId);

                    if (error) {
                        throw ErrorHandler.createError('PAYMENT_FAILED', 'Error al procesar pago con crédito');
                    }

                    result = {
                        success: true,
                        method: `💳 Crédito (${methods.credit.cardType})`,
                        methodKey: 'credit',
                        amount,
                        remaining: methods.credit.balance - amount
                    };
                    break;

                default:
                    throw ErrorHandler.createError('INVALID_PAYMENT_METHOD', 'Método de pago no válido');
            }

            // Log transaction
            logger.transaction('payment', amount, userId, {
                method: result.methodKey,
                reason
            });

            return result;
        } catch (error) {
            // Re-throw if it's already a formatted error (Standard codes are usually UPPERCASE)
            if (error.code && typeof error.code === 'string' && error.code === error.code.toUpperCase() && !error.code.startsWith('ERR_')) {
                throw error;
            }
            logger.errorWithContext('Payment processing failed', error, { method, userId, amount });

            // Detect Insufficient Funds from UB API message
            if (error.message && (error.message.includes('insufficient') || error.message.includes('funds'))) {
                const lowFundsErr = new Error(`Fondos insuficientes: ${error.message}`);
                lowFundsErr.code = 'INSUFFICIENT_FUNDS';
                throw lowFundsErr;
            }

            // Manually construct PAYMENT_FAILED error to be 100% sure
            const newError = new Error(`Error al procesar el pago: ${error.message}`);
            newError.code = 'PAYMENT_FAILED';
            throw newError;
        }
    }

    /**
     * Create payment buttons for Discord
     * @param {number} amount - Payment amount
     * @param {Object} availableMethods - Available payment methods
     * @param {string} prefix - Button ID prefix (e.g., 'pay_')
     * @returns {ActionRowBuilder} Button row
     */
    createPaymentButtons(amount, availableMethods, prefix = 'pay') {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const buttons = [];

        if (availableMethods.cash.available) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_cash_${amount}`)
                    .setLabel('💵 Efectivo')
                    .setStyle(ButtonStyle.Success)
            );
        }

        if (availableMethods.debit.available) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_debit_${amount}`)
                    .setLabel(`💳 Débito`)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        if (availableMethods.credit.available) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`${prefix}_credit_${amount}`)
                    .setLabel('💳 Crédito')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        buttons.push(
            new ButtonBuilder()
                .setCustomId(`${prefix}_cancel`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

        return new ActionRowBuilder().addComponents(buttons);
    }

    /**
     * Create payment embed
     * @param {number} amount - Amount to pay
     * @param {string} description - Payment description
     * @param {Object} availableMethods - Available methods
     * @returns {EmbedBuilder} Payment embed
     */
    createPaymentEmbed(amount, description, availableMethods) {
        const { EmbedBuilder } = require('discord.js');

        const methodsText = [];
        if (availableMethods.cash.available) {
            methodsText.push(`💵 **Efectivo:** $${availableMethods.cash.balance.toLocaleString()}`);
        }
        if (availableMethods.debit.available) {
            methodsText.push(`💳 **Débito (${availableMethods.debit.cardTier}):** $${availableMethods.debit.balance.toLocaleString()}`);
        }
        if (availableMethods.credit.available) {
            methodsText.push(`💳 **Crédito (${availableMethods.credit.cardType}):** $${availableMethods.credit.balance.toLocaleString()} disponible`);
        }

        const embed = new EmbedBuilder()
            .setTitle('💳 Selecciona Método de Pago')
            .setDescription(description || 'Selecciona cómo deseas pagar')
            .addFields(
                { name: '💰 Monto a Pagar', value: `$${amount.toLocaleString()}`, inline: true },
                { name: '📊 Métodos Disponibles', value: methodsText.join('\n') || '❌ No hay métodos disponibles', inline: false }
            )
            .setColor(0x00FF00)
            .setFooter({ text: 'Selecciona un botón para proceder' })
            .setTimestamp();

        return embed;
    }
}

module.exports = PaymentProcessor;
