/**
 * ConfirmationService - Handles large transaction confirmations
 * Prevents accidental transfers of large amounts
 */
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const logger = require('./Logger');

class ConfirmationService {
    constructor() {
        // Configurable thresholds
        this.thresholds = {
            transfer: 50000,      // $50k for transfers
            payment: 100000,      // $100k for payments
            withdrawal: 75000,    // $75k for withdrawals
            loan: 200000          // $200k for loans
        };

        this.timeoutMs = 60000; // 60 seconds timeout
        this.confirmations = new Map(); // Track pending confirmations
    }

    /**
     * Check if amount requires confirmation
     * @param {string} type - Transaction type
     * @param {number} amount - Amount to check
     * @returns {boolean}
     */
    requiresConfirmation(type, amount) {
        const threshold = this.thresholds[type] || this.thresholds.transfer;
        return amount >= threshold;
    }

    /**
     * Request confirmation for large transaction
     * @param {object} interaction - Discord interaction
     * @param {object} params - Transaction parameters
     * @returns {Promise<boolean>} - True if confirmed, false if rejected/timeout
     */
    async requestConfirmation(interaction, params) {
        const { type, amount, description, recipient } = params;

        // Generate unique ID
        const confirmId = `confirm_${Date.now()}_${interaction.user.id}`;

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Confirmación de Transacción Grande')
            .setColor(0xFFA500)
            .setDescription(`Estás a punto de realizar una transacción de **$${amount.toLocaleString()}**.`)
            .addFields(
                { name: '💰 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                { name: '📋 Tipo', value: type, inline: true },
                { name: '👤 Destinatario', value: recipient || 'N/A', inline: true },
                { name: '📝 Descripción', value: description || 'Sin descripción', inline: false }
            )
            .setFooter({ text: 'Tienes 60 segundos para confirmar. Esta acción no puede deshacerse.' })
            .setTimestamp();

        // Create buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`${confirmId}_yes`)
                    .setLabel('✅ Confirmar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`${confirmId}_no`)
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send confirmation message
        const message = await interaction.followUp({
            embeds: [embed],
            components: [row],
            ephemeral: false
        });

        // Store confirmation data
        this.confirmations.set(confirmId, {
            userId: interaction.user.id,
            params,
            timestamp: Date.now()
        });

        // Wait for response
        return new Promise((resolve) => {
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: this.timeoutMs
            });

            let resolved = false;

            collector.on('collect', async i => {
                if (i.customId === `${confirmId}_yes`) {
                    await i.update({
                        content: '✅ **Transacción confirmada.** Procesando...',
                        embeds: [],
                        components: []
                    });

                    logger.info(`Large transaction confirmed: ${type} - $${amount} by ${interaction.user.id}`);
                    resolved = true;
                    resolve(true);
                } else if (i.customId === `${confirmId}_no`) {
                    await i.update({
                        content: '❌ **Transacción cancelada.**',
                        embeds: [],
                        components: []
                    });

                    logger.info(`Large transaction rejected: ${type} - $${amount} by ${interaction.user.id}`);
                    resolved = true;
                    resolve(false);
                }

                // Cleanup
                this.confirmations.delete(confirmId);
                collector.stop();
            });

            collector.on('end', async () => {
                if (!resolved) {
                    // Timeout
                    await message.edit({
                        content: '⏱️ **Tiempo agotado.** Transacción cancelada por seguridad.',
                        embeds: [],
                        components: []
                    });

                    logger.warn(`Large transaction timeout: ${type} - $${amount} by ${interaction.user.id}`);
                    this.confirmations.delete(confirmId);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Update threshold for a transaction type
     * @param {string} type 
     * @param {number} newThreshold 
     */
    setThreshold(type, newThreshold) {
        this.thresholds[type] = newThreshold;
        logger.info(`Threshold updated: ${type} = $${newThreshold}`);
    }

    /**
     * Get current thresholds
     * @returns {object}
     */
    getThresholds() {
        return { ...this.thresholds };
    }
}

module.exports = ConfirmationService;
