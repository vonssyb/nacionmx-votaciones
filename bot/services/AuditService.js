/**
 * AuditService - Enhanced Transaction Logging and Audit Trail
 * 
 * This service provides comprehensive logging for all economic transactions
 * with rollback capability and fraud detection.
 */

class AuditService {
    constructor(supabase, client) {
        this.supabase = supabase;
        this.client = client;

        // Channel routing
        this.SANCTIONS_LOG_CHANNEL_ID = '1456021466356387861'; // Canal de logs de sanciones
        this.SECURITY_ALERTS_CHANNEL_ID = '1456047784724529316'; // Canal de alertas de seguridad (admin/junta)
    }

    /**
     * Log a transaction to the audit system
     * @param {Object} params - Transaction parameters
     * @returns {Promise<Object>} - Logged transaction record
     */
    async logTransaction({
        guildId,
        userId,
        transactionType,
        amount,
        currencyType = 'cash',
        targetUserId = null,
        itemDescription = null,
        reason = null,
        metadata = {},
        createdBy,
        createdByTag,
        commandName = null,
        interactionId = null,
        canRollback = true
    }) {
        try {
            const { data, error } = await this.supabase
                .from('transaction_logs')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    transaction_type: transactionType,
                    amount,
                    currency_type: currencyType,
                    target_user_id: targetUserId,
                    item_description: itemDescription,
                    reason,
                    metadata,
                    created_by: createdBy,
                    created_by_tag: createdByTag,
                    command_name: commandName,
                    interaction_id: interactionId,
                    can_rollback: canRollback
                })
                .select()
                .single();

            if (error) {
                console.error('[AuditService] Error logging transaction:', error);
                return null;
            }

            // Check if transaction is suspicious
            if (amount && amount > 100000) {
                await this.flagSuspiciousTransaction(data);
            }

            return data;
        } catch (error) {
            console.error('[AuditService] Exception logging transaction:', error);
            return null;
        }
    }

    /**
     * Rollback a transaction (if possible)
     * @param {number} transactionId - ID of transaction to rollback
     * @param {string} adminId - Discord ID of admin performing rollback
     * @param {string} reason - Reason for rollback
     * @returns {Promise<boolean>} - Success status
     */
    async rollbackTransaction(transactionId, adminId, reason) {
        try {
            // Get original transaction
            const { data: original, error: fetchError } = await this.supabase
                .from('transaction_logs')
                .select('*')
                .eq('id', transactionId)
                .single();

            if (fetchError || !original) {
                console.error('[AuditService] Transaction not found:', fetchError);
                return false;
            }

            if (!original.can_rollback) {
                console.error('[AuditService] Transaction cannot be rolled back');
                return false;
            }

            if (original.rolled_back) {
                console.error('[AuditService] Transaction already rolled back');
                return false;
            }

            // Reverse the transaction in user_balances
            const reverseAmount = -original.amount;
            const { error: updateError } = await this.supabase.rpc('adjust_balance', {
                p_guild_id: original.guild_id,
                p_user_id: original.user_id,
                p_amount: reverseAmount,
                p_column: original.currency_type
            });

            if (updateError) {
                console.error('[AuditService] Error reversing balance:', updateError);
                return false;
            }

            // Mark original as rolled back
            await this.supabase
                .from('transaction_logs')
                .update({ rolled_back: true })
                .eq('id', transactionId);

            // Log the rollback transaction
            await this.logTransaction({
                guildId: original.guild_id,
                userId: original.user_id,
                transactionType: `rollback_${original.transaction_type}`,
                amount: reverseAmount,
                currencyType: original.currency_type,
                reason: `ROLLBACK: ${reason}`,
                metadata: {
                    original_transaction_id: transactionId,
                    original_metadata: original.metadata,
                    rollback_reason: reason
                },
                createdBy: adminId,
                createdByTag: 'Admin Rollback',
                canRollback: false
            });

            console.log(`[AuditService] Successfully rolled back transaction ${transactionId}`);
            return true;

        } catch (error) {
            console.error('[AuditService] Exception during rollback:', error);
            return false;
        }
    }

    /**
     * Flag suspicious transaction and alert admins
     * @param {Object} transaction - Transaction record
     */
    async flagSuspiciousTransaction(transaction) {
        try {
            const alertChannel = await this.client.channels.fetch(this.AUDIT_CHANNEL_ID);
            if (!alertChannel) return;

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle('🚨 TRANSACCIÓN SOSPECHOSA DETECTADA')
                .setColor('#FF0000')
                .addFields(
                    { name: '💰 Cantidad', value: `$${transaction.amount?.toLocaleString() || 'N/A'}`, inline: true },
                    { name: '📊 Tipo', value: transaction.transaction_type, inline: true },
                    { name: '👤 Usuario', value: `<@${transaction.user_id}>`, inline: true },
                    { name: '👮 Ejecutado por', value: `<@${transaction.created_by}>`, inline: true },
                    { name: '📝 Razón', value: transaction.reason || 'Sin razón especificada', inline: false },
                    { name: '🔍 ID Transacción', value: `#${transaction.id}`, inline: true }
                )
                .setFooter({ text: 'Sistema de Detección de Fraude' })
                .setTimestamp();

            await alertChannel.send({
                content: '@here Revisar transacción sospechosa',
                embeds: [embed]
            });

        } catch (error) {
            console.error('[AuditService] Error flagging suspicious transaction:', error);
        }
    }

    /**
     * Get transaction history for a user
     * @param {string} guildId - Guild ID
     * @param {string} userId - User Discord ID
     * @param {number} limit - Max records to return
     * @returns {Promise<Array>} - Transaction records
     */
    async getUserTransactionHistory(guildId, userId, limit = 50) {
        const { data, error } = await this.supabase
            .from('transaction_logs')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[AuditService] Error fetching history:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Get suspicious transactions
     * @param {string} guildId - Guild ID
     * @returns {Promise<Array>} - Suspicious transactions
     */
    async getSuspiciousTransactions(guildId) {
        const { data, error } = await this.supabase
            .from('suspicious_transactions')
            .select('*')
            .eq('guild_id', guildId)
            .limit(20);

        if (error) {
            console.error('[AuditService] Error fetching suspicious:', error);
            return [];
        }

        return data || [];
    }
}

module.exports = AuditService;
