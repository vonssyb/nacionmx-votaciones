/**
 * @module handlers/economy/payments/credit
 * @description Maneja el pago de deudas de tarjetas de crédito personales
 * 
 * Este módulo gestiona:
 * - Botones de pago de deuda (cred_pay_method_amount_cardId)
 * - Verificación de fondos via PaymentProcessor
 * - Reducción de saldo de deuda en DB
 * - Actualización de historial de pagos
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class CreditPaymentHandler {
    constructor(client, supabase, paymentProcessor) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
    }

    /**
     * Maneja las interacciones de botones de pago de crédito
     * @param {Interaction} interaction - Discord button interaction
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // Filter: cred_pay_method_amount_cardId
            if (!interaction.isButton() || !customId.startsWith('cred_pay_')) {
                return false;
            }

            // Legacy collector safety check
            // Legacy uses: cred_pay_method (3 parts)
            // New uses: cred_pay_method_amount_cardId (5 parts)
            const parts = customId.split('_');
            // 0:cred, 1:pay, 2:method, 3:amount, 4:cardId

            if (parts.length < 5) {
                logger.debug('Legacy credit pay button ignored (collector handles it)', { customId });
                return false;
            }

            const method = parts[2];
            const amount = parseFloat(parts[3]);
            const cardId = parts[4];

            logger.info('Processing credit payment', {
                userId: interaction.user.id,
                cardId,
                amount,
                method
            });

            await interaction.deferUpdate();

            // 1. Get and Validate Card
            // We need to join with citizen to verify ownership if needed, 
            // but usually the button is generated for the owner.
            // We'll trust the ID but verify existence.
            const { data: card, error: cardError } = await this.supabase
                .from('credit_cards')
                .select('*')
                .eq('id', cardId)
                .single();

            if (cardError || !card) {
                await interaction.followUp({ content: '❌ Tarjeta no encontrada.', ephemeral: true });
                return true;
            }

            // Validate amount vs debt
            // It's possible debt changed since button was made, but overpaying reduces debt further (negative balance = credit).
            // We'll allow it generally, or warn.
            if (amount > card.current_balance && card.current_balance > 0) {
                // Optional: warn if they are paying way more?
                // For now, allow it, as they might want to prepay.
            }

            // 2. Process Payment (Charge User)
            const paymentResult = await this.paymentProcessor.processPayment(
                method,
                interaction.user.id,
                interaction.guildId,
                amount,
                `Pago Tarjeta: ${card.card_type || 'Crédito'}`
            );

            if (!paymentResult.success) {
                await interaction.followUp({
                    content: `❌ **Error en el pago**\n${paymentResult.error}`,
                    ephemeral: true
                });
                return true;
            }

            // 3. Update Debt & Log Payment
            const newDebt = (card.current_balance || 0) - amount;

            const { error: updateError } = await this.supabase
                .from('credit_cards')
                .update({
                    current_balance: newDebt
                })
                .eq('id', cardId);

            if (updateError) {
                logger.errorWithContext('Failed to update credit card balance', updateError, { cardId, newDebt });
                await interaction.followUp({
                    content: `⚠️ Pago procesado pero error actualizando saldo tarjeta. Soporte ID: ${paymentResult.transactionId}`,
                    ephemeral: true
                });
                return true;
            }

            // 4. Record Payment History (Optional but good practice)
            // If table exists `credit_card_payments`
            try {
                await this.supabase.from('credit_card_payments').insert([{
                    card_id: cardId,
                    amount: amount,
                    payment_method: method,
                    payment_date: new Date().toISOString()
                }]);
            } catch (histError) {
                // Non-blocking error
                logger.warn('Failed to insert credit card payment history', { error: histError.message });
            }

            // 5. Success Response
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Pago de Crédito Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Se abonó **$${amount.toLocaleString()}** a tu tarjeta.`)
                .addFields(
                    { name: '💳 Tarjeta', value: card.card_type || 'Crédito Personal', inline: true },
                    { name: '💰 Abono', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Nuevo Saldo', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: '💳 Método', value: paymentResult.methodName, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'credit_payment',
                customId: interaction.customId
            });
            return true;
        }
    }
}

module.exports = CreditPaymentHandler;
