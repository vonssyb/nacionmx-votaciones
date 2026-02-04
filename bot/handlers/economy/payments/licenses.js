/**
 * @module handlers/economy/payments/licenses
 * @description Maneja el pago y otorgamiento de licencias
 * 
 * Este módulo gestiona:
 * - Botones de pago de licencias (license_pay_method_amount_roleId_targetUserId)
 * - Verificación de fondos via PaymentProcessor
 * - Asignación de roles de licencia
 * - Logging de transacciones
 * - Notificaciones al usuario
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

const LOG_LICENCIAS = '1450262813548482665';

class LicensePaymentHandler {
    constructor(client, supabase, paymentProcessor) {
        this.client = client;
        this.supabase = supabase;
        this.paymentProcessor = paymentProcessor;
    }

    /**
     * Maneja las interacciones de botones de pago de licencias
     * @param {Interaction} interaction - Discord button interaction
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction) {
        try {
            const { customId } = interaction;

            // Filter: license_pay_method_amount_roleId_targetId
            if (!interaction.isButton() || !customId.startsWith('license_pay_')) {
                return false;
            }

            // Evitar conflictos con collectors legacy (si el ID es corto, es legacy)
            const parts = customId.split('_');
            // Legacy: license_pay_method (3 parts)
            // New: license_pay_method_amount_roleId_targetId (6 parts)

            if (parts.length < 5) {
                logger.debug('Ignoring legacy license button (handled by collector)', { customId });
                return false;
            }

            const method = parts[2];
            const amount = parseFloat(parts[3]);
            const roleId = parts[4];
            const targetUserId = parts[5];

            logger.info('Processing license payment', {
                buyerId: interaction.user.id,
                targetId: targetUserId,
                amount,
                roleId,
                method
            });

            // Security check: Only the target user usually pays, but maybe staff can pay for them?
            // Assuming 'targetUserId' IS the payer for now, or the person RECEIVING the license.
            // Usually buttons are clicked by the person paying.
            // If targetUserId != interaction.user.id, we should verify who is paying.
            // For now, assume interaction.user is the payer AND receiver (self-service) 
            // OR processing a payment where payer = interaction.user.

            await interaction.deferUpdate();

            // 1. Validate Target Member & Role
            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUserId).catch(() => null);

            if (!member) {
                await interaction.followUp({ content: '❌ El usuario beneficiario no se encuentra en el servidor.', ephemeral: true });
                return true;
            }

            if (member.roles.cache.has(roleId)) {
                await interaction.followUp({ content: `⚠️ <@${targetUserId}> ya tiene esta licencia.`, ephemeral: true });
                return true;
            }

            const role = guild.roles.cache.get(roleId);
            const licenseName = role ? role.name : 'Licencia Desconocida';

            // 2. Process Payment
            const paymentResult = await this.paymentProcessor.processPayment(
                method,
                interaction.user.id, // Payer
                interaction.guildId,
                amount,
                `Licencia: ${licenseName}`
            );

            if (!paymentResult.success) {
                await interaction.followUp({
                    content: `❌ **Error en el pago**\n${paymentResult.error}`,
                    ephemeral: true
                });
                return true;
            }

            // 3. Assign Role
            try {
                await member.roles.add(roleId);
            } catch (roleError) {
                logger.errorWithContext('Failed to add license role', roleError, { roleId, targetUserId });
                // Refund logic would go here ideally
                await interaction.followUp({ content: '⚠️ Pago procesado pero hubo un error asignando el rol. Contacta a soporte.' });
                return true;
            }

            // 4. Success Response & Logging
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Licencia Otorgada')
                .setDescription(`${licenseName}`)
                .addFields(
                    { name: '👤 Ciudadano', value: `<@${targetUserId}>`, inline: true },
                    { name: '💰 Costo', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '💳 Método', value: paymentResult.methodName, inline: true },
                    { name: '👮 Emitida por', value: interaction.user.tag, inline: true }
                )
                .setFooter({ text: 'Licencia Oficial Nación MX' })
                .setTimestamp();

            // Update the button message to show success
            await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });

            // Log to channel
            this._logLicense(guild, targetUserId, licenseName, amount, interaction.user.id);

            // 5. Deposit to Government Treasury
            if (this.client.treasuryService) {
                await this.client.treasuryService.addFunds(
                    interaction.guildId,
                    amount,
                    'Licencias',
                    `Pago de ${licenseName} para <@${targetUserId}>`
                );
            }

            // DM User
            try {
                await member.send({
                    content: `🪪 **Nueva Licencia Registrada**`,
                    embeds: [successEmbed]
                });
            } catch (dmError) {
                logger.debug('Could not DM user for license', { userId: targetUserId });
            }

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'license_payment',
                customId: interaction.customId
            });
            return true;
        }
    }

    /**
     * Log license to configured channel
     * @private
     */
    async _logLicense(guild, targetUserId, licenseName, amount, authorId) {
        try {
            const channel = guild.channels.cache.get(LOG_LICENCIAS);
            if (!channel) return;

            const logEmbed = new EmbedBuilder()
                .setTitle('🪪 Nueva Licencia Otorgada')
                .setColor('#00AAC0')
                .addFields(
                    { name: 'Ciudadano', value: `<@${targetUserId}>`, inline: true },
                    { name: 'Licencia', value: licenseName, inline: true },
                    { name: 'Costo', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: 'Autorizado por', value: `<@${authorId}>`, inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [logEmbed] });
        } catch (error) {
            logger.error('Failed to log license', error);
        }
    }
}

module.exports = LicensePaymentHandler;
