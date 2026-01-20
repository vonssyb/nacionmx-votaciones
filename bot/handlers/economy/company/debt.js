/**
 * @module handlers/economy/company/debt
 * @description Maneja el pago de deudas de tarjetas empresariales
 * 
 * Este módulo gestiona:
 * - Botones de pago de deuda (pay_biz_debt_method_cardId_amount)
 * - Verificación de fondos via PaymentProcessor
 * - Reducción de saldo de deuda en DB
 * - Logging y notificaciones
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class CompanyDebtHandler {
    constructor(client, supabase, paymentProcessor) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
    }

    /**
     * Maneja las interacciones de botones de pago de deuda
     * @param {Interaction} interaction - Discord button interaction
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // Filter: pay_biz_debt_method_cardId_amount
            if (!interaction.isButton() || !customId.startsWith('pay_biz_debt_')) {
                return false;
            }

            const parts = customId.split('_');
            // 0:pay, 1:biz, 2:debt, 3:method, 4:cardId, 5:amount

            if (parts.length < 6) {
                logger.warn('Invalid company debt button format', { customId });
                return false;
            }

            const method = parts[3];
            const cardId = parts[4];
            const amount = parseFloat(parts[5]);

            logger.info('Processing company debt payment', {
                userId: interaction.user.id,
                cardId,
                amount,
                method
            });

            await interaction.deferUpdate();

            // 1. Get Card & Company Info
            const { data: card, error: cardError } = await this.supabase
                .from('business_credit_cards')
                .select('*, companies!inner(name)')
                .eq('id', cardId)
                .single();

            if (cardError || !card) {
                await interaction.followUp({ content: '❌ Tarjeta no encontrada o error de base de datos.', ephemeral: true });
                return true;
            }

            // 2. Process Payment (Charge User)
            const paymentResult = await this.paymentProcessor.processPayment(
                method,
                interaction.user.id,
                interaction.guildId,
                amount,
                `Pago deuda empresarial: ${card.companies.name}`
            );

            if (!paymentResult.success) {
                await interaction.followUp({
                    content: `❌ **Error en el pago**\n${paymentResult.error}`,
                    ephemeral: true
                });
                return true;
            }

            // 3. Reduce Debt (Update DB)
            const newDebt = (card.current_balance || 0) - amount;

            // Prevent negative debt? Assuming debt is positive balance.
            // If newDebt < 0, it means overpayment. Usually OK (negative balance = credit).

            const { error: updateError } = await this.supabase
                .from('business_credit_cards')
                .update({
                    current_balance: newDebt,
                    updated_at: new Date().toISOString()
                })
                .eq('id', cardId);

            if (updateError) {
                logger.errorWithContext('Failed to update card balance after payment', updateError, {
                    cardId, userId: interaction.user.id, amount, transactionId: paymentResult.transactionId
                });
                await interaction.followUp({
                    content: `⚠️ Pago procesado ($${amount}) pero hubo un error actualizando la deuda. Contacta a soporte con ID: ${paymentResult.transactionId}`,
                    ephemeral: true
                });
                return true;
            }

            // 4. Success Response
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Pago de Deuda Exitoso')
                .setColor(0x00FF00)
                .setDescription(`Se abonó **$${amount.toLocaleString()}** a tu tarjeta empresarial`)
                .addFields(
                    { name: '🏢 Empresa', value: card.companies.name, inline: true },
                    { name: '💳 Tarjeta', value: card.card_name, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '💰 Abono', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📊 Deuda Anterior', value: `$${(card.current_balance || 0).toLocaleString()}`, inline: true },
                    { name: '📈 Nueva Deuda', value: `$${newDebt.toLocaleString()}`, inline: true },
                    { name: '💳 Método', value: paymentResult.methodName, inline: false }
                )
                .setFooter({ text: '¡Excelente manejo financiero!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], components: [] });

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'company_debt_payment',
                customId: interaction.customId
            });
            return true;
        }
    }
}

module.exports = CompanyDebtHandler;
