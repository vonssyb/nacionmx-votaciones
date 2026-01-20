/**
 * SelfActionService - Self-Action Prevention System
 * 
 * Prevents moderators from performing actions on themselves such as:
 * - Self-approving appeals
 * - Self-assigning roles
 * - Self-adding money
 * - Self-removing sanctions
 * - Self-editing warns
 * 
 * When detected, sends @here notification to security channel for superior approval.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class SelfActionService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;

        // Security alerts channel (same as AuditService)
        this.SECURITY_ALERTS_CHANNEL_ID = '1456047784724529316';

        // Roles allowed to approve self-actions
        this.APPROVER_ROLES = [
            '1412882245735420006', // Junta Directiva
            '1456020936229912781', // Encargado de Sanciones
            '1451703422800625777', // Encargado de Apelaciones
            '1454985316292100226'  // Encargado de Staff
        ];
    }

    /**
     * Check if user is attempting self-action
     * @param {string} executorId - User executing the action
     * @param {string} targetId - Target user of the action
     * @returns {boolean}
     */
    isSelfAction(executorId, targetId) {
        return executorId === targetId;
    }

    /**
     * Check if user has permission to approve self-actions
     * @param {GuildMember} member - Guild member
     * @returns {boolean}
     */
    canApproveSelfAction(member) {
        return member.roles.cache.some(r => this.APPROVER_ROLES.includes(r.id)) ||
            member.permissions.has('Administrator');
    }

    /**
     * Send superior approval request for self-actions
     * @param {Object} params - Request parameters
     * @returns {Promise<void>}
     */
    async requestSuperiorApproval({
        actionType, // 'appeal', 'role_add', 'role_remove', 'money_add', 'money_remove', 'sanction_remove', 'warn_edit', 'history_clear'
        executor,
        target,
        guildId,
        details,
        approveButtonId,
        rejectButtonId,
        metadata = {}
    }) {
        try {
            const alertChannel = await this.client.channels.fetch(this.SECURITY_ALERTS_CHANNEL_ID);
            if (!alertChannel) {
                console.error('[SelfAction] Security alerts channel not found');
                return;
            }

            // Log attempt to database
            await this.logSelfActionAttempt({
                guildId,
                userId: executor.id,
                actionType,
                targetId: target?.id,
                details,
                metadata
            });

            // Create embed based on action type
            const embed = this.createAlertEmbed(actionType, executor, target, details, metadata);

            // Create approval buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(approveButtonId)
                    .setLabel('✅ Aprobar Auto-Acción')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(rejectButtonId)
                    .setLabel('❌ Rechazar')
                    .setStyle(ButtonStyle.Danger)
            );

            await alertChannel.send({
                content: '@here **🚨 AUTO-ACCIÓN DETECTADA - REQUIERE APROBACIÓN**',
                embeds: [embed],
                components: [row]
            });

            console.log(`[SelfAction] Request sent for ${actionType} by ${executor.tag}`);

        } catch (error) {
            console.error('[SelfAction] Error sending approval request:', error);
        }
    }

    /**
     * Create alert embed based on action type
     * @param {string} actionType
     * @param {User} executor
     * @param {User} target
     * @param {string} details
     * @param {Object} metadata
     * @returns {EmbedBuilder}
     */
    createAlertEmbed(actionType, executor, target, details, metadata) {
        const actionLabels = {
            appeal: '⚖️ AUTO-APELACIÓN DE SANCIÓN',
            role_add: '👑 AUTO-ASIGNACIÓN DE ROL',
            role_remove: '👑 AUTO-REMOCIÓN DE ROL',
            money_add: '💰 AUTO-ADICIÓN DE DINERO',
            money_remove: '💰 AUTO-REMOCIÓN DE DINERO',
            sanction_remove: '🛡️ AUTO-ELIMINACIÓN DE SANCIÓN',
            warn_edit: '⚠️ AUTO-EDICIÓN DE WARN',
            history_clear: '🗑️ AUTO-LIMPIEZA DE HISTORIAL'
        };

        const embed = new EmbedBuilder()
            .setTitle(actionLabels[actionType] || '🚨 AUTO-ACCIÓN DETECTADA')
            .setColor('#FF0000')
            .addFields(
                { name: '👤 Moderador', value: `<@${executor.id}> (${executor.tag})`, inline: true },
                { name: '🎯 Usuario Objetivo', value: target ? `<@${target.id}> (${target.tag})` : 'N/A', inline: true },
                { name: '⚠️ Tipo de Acción', value: this.getActionDescription(actionType), inline: false },
                { name: '📝 Detalles', value: details || 'Sin detalles', inline: false }
            )
            .setFooter({ text: 'Sistema de Prevención de Auto-Acciones | Requiere aprobación superior' })
            .setTimestamp();

        // Add metadata fields if present
        if (metadata.role) {
            embed.addFields({ name: '🎭 Rol', value: metadata.role, inline: true });
        }
        if (metadata.amount) {
            embed.addFields({ name: '💵 Cantidad', value: `$${metadata.amount.toLocaleString()}`, inline: true });
        }
        if (metadata.sanctionId) {
            embed.addFields({ name: '🆔 Sanción ID', value: metadata.sanctionId, inline: true });
        }

        return embed;
    }

    /**
     * Get human-readable action description
     * @param {string} actionType
     * @returns {string}
     */
    getActionDescription(actionType) {
        const descriptions = {
            appeal: 'El moderador intenta aprobar su propia apelación',
            role_add: 'El moderador intenta asignarse un rol a sí mismo',
            role_remove: 'El moderador intenta quitarse un rol a sí mismo',
            money_add: 'El moderador intenta añadirse dinero a sí mismo',
            money_remove: 'El moderador intenta quitarse dinero a sí mismo',
            sanction_remove: 'El moderador intenta eliminar una sanción propia',
            warn_edit: 'El moderador intenta editar sus propios warns',
            history_clear: 'El moderador intenta limpiar su propio historial'
        };
        return descriptions[actionType] || 'Acción no especificada';
    }

    /**
     * Log self-action attempt to database
     * @param {Object} params
     * @returns {Promise<void>}
     */
    async logSelfActionAttempt({ guildId, userId, actionType, targetId, details, metadata }) {
        try {
            const { error } = await this.supabase
                .from('self_action_attempts')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    action_type: actionType,
                    target_id: targetId,
                    reason: details,
                    metadata: metadata,
                    status: 'pending'
                });

            if (error) {
                console.error('[SelfAction] Failed to log attempt:', error);
            }
        } catch (error) {
            console.error('[SelfAction] Exception logging attempt:', error);
        }
    }

    /**
     * Update self-action attempt status
     * @param {string} attemptId - Attempt ID
     * @param {string} status - 'approved' or 'rejected'
     * @param {string} approvedBy - ID of user who approved/rejected
     * @returns {Promise<void>}
     */
    async updateAttemptStatus(attemptId, status, approvedBy) {
        try {
            const { error } = await this.supabase
                .from('self_action_attempts')
                .update({
                    status,
                    approved_by: approvedBy,
                    resolved_at: new Date().toISOString()
                })
                .eq('id', attemptId);

            if (error) {
                console.error('[SelfAction] Failed to update status:', error);
            }
        } catch (error) {
            console.error('[SelfAction] Exception updating status:', error);
        }
    }

    /**
     * Check if appeal is self-appeal (user appealing their own sanction and trying to approve it)
     * @param {string} appealUserId - User who created the appeal
     * @param {string} approvingUserId - User trying to approve the appeal
     * @returns {boolean}
     */
    isSelfAppeal(appealUserId, approvingUserId) {
        return appealUserId === approvingUserId;
    }
}

module.exports = SelfActionService;
