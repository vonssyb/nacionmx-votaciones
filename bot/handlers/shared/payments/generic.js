/**
 * @module handlers/shared/payments/generic
 * @description Maneja los pagos genéricos a empresas (pay_*)
 * 
 * Este módulo gestiona:
 * - Botones de pago (pay_method_amount_companyId)
 * - Métodos: cash, debit, credit
 * - Validación de empresa
 * - Procesamiento del pago (cargo a usuario + abono a empresa)
 * - Cancelación de pagos
 */

const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class GenericPaymentHandler {
    constructor(supabase, paymentProcessor) {
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
    }

    /**
     * Maneja las interacciones de botones de pago
     * @param {Interaction} interaction - Discord button interaction
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // Solo procesar botones de pago genéricos
            if (!interaction.isButton() || !customId.startsWith('pay_')) {
                return false;
            }

            const parts = customId.split('_');
            // Format: pay_method_amount_companyId
            const paymentMethod = parts[1]; // cash, debit, credit, cancel

            // Handle cancellation
            if (paymentMethod === 'cancel') {
                await interaction.update({
                    content: '❌ Pago cancelado por el cliente.',
                    embeds: [],
                    components: []
                });
                logger.info('Payment cancelled by user', { userId: interaction.user.id });
                return true;
            }

            const amount = parseFloat(parts[2]);
            const companyId = parts[3];

            logger.info('Processing generic payment', {
                userId: interaction.user.id,
                method: paymentMethod,
                amount,
                companyId
            });

            // deferUpdate to allow processing time
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            // Validate inputs
            if (isNaN(amount) || amount <= 0) {
                await interaction.followUp({ content: '❌ Monto inválido.', ephemeral: true });
                return true;
            }

            if (!companyId) {
                await interaction.followUp({ content: '❌ ID de empresa inválido.', ephemeral: true });
                return true;
            }

            // Get company data
            const { data: company, error: companyError } = await this.supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (companyError || !company) {
                logger.warn('Company not found for payment', { companyId });
                await interaction.followUp({ content: '❌ Empresa no encontrada.', ephemeral: true });
                return true;
            }

            // Get reason from original embed
            let reason = 'Servicio';
            if (interaction.message && interaction.message.embeds.length > 0) {
                const originalEmbed = interaction.message.embeds[0];
                const conceptField = originalEmbed.fields.find(f => f.name === '🧾 Concepto' || f.name === 'Concepto');
                if (conceptField) reason = conceptField.value;
            }

            // 1. Process Charge (User -> System)
            const result = await this.paymentProcessor.processPayment(
                paymentMethod,
                interaction.user.id,
                interaction.guildId,
                amount,
                `Pago a ${company.name}: ${reason}`
            );

            if (!result.success) {
                await interaction.followUp({
                    content: `❌ **Error en el pago**\n${result.error}`,
                    ephemeral: true
                });
                return true;
            }

            // 2. Credit Company (System -> Company)
            const { error: creditError } = await this.supabase
                .from('companies')
                .update({ balance: (company.balance || 0) + amount })
                .eq('id', companyId);

            if (creditError) {
                // Critical error: User charged but company not credited
                // In a real system we would need a transaction or rollback
                logger.errorWithContext('CRITICAL: User charged but company update failed', creditError, {
                    userId: interaction.user.id,
                    companyId,
                    amount,
                    transactionId: result.transactionId
                });

                await interaction.followUp({
                    content: `⚠️ **Advertencia:** El pago se procesó pero hubo un error actualizando el saldo de la empresa. Contacta a soporte con ID: ${result.transactionId}`
                });
                return true;
            }

            // 3. Success Response
            const successMessage = `✅ **Pago Exitoso**\n` +
                `🏢 **Empresa:** ${company.name}\n` +
                `💰 **Monto:** $${amount.toLocaleString()}\n` +
                `💳 **Método:** ${result.methodName}\n` +
                `🧾 **Ref:** \`${result.transactionId}\``;

            if (interaction.message) {
                // Update original message to remove buttons and show success
                await interaction.editReply({
                    content: successMessage,
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.followUp({ content: successMessage });
            }

            logger.info('Generic payment completed successfully', {
                userId: interaction.user.id,
                companyId,
                amount,
                method: paymentMethod
            });

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'generic_payment',
                customId: interaction.customId
            });
            return true;
        }
    }
}

module.exports = GenericPaymentHandler;
