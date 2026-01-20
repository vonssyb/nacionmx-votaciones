/**
 * @module handlers/economy/missions/claim
 * @description Maneja el reclamo de recompensas de misiones
 * 
 * Este módulo gestiona:
 * - Botón de reclamar recompensa (claim_mission_)
 * - Validación de misiones completadas
 * - Entrega de recompensas (XP + dinero)
 * - Actualización de estado de misiones
 */

const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class MissionClaimHandler {
    constructor(supabase, missionService) {
        this.supabase = supabase;
        this.missionService = missionService;
    }

    /**
     * Maneja las interacciones de botones de misiones
     * @param {Interaction} interaction - Discord button interaction
     * @param {Client} client - Discord client
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction, client) {
        try {
            if (!interaction.isButton()) return false;

            const { customId, user } = interaction;

            // Check if this is a mission claim button
            if (!customId.startsWith('claim_mission_')) {
                return false;
            }

            const missionId = customId.replace('claim_mission_', '');
            const userId = user.id;

            logger.info('Processing mission claim', { userId, missionId });

            // Claim rewards using MissionService
            const result = await this.missionService.claimRewards(userId, missionId);

            if (result.success) {
                await this._sendSuccessMessage(interaction, result);

                logger.info('Mission rewards claimed successfully', {
                    userId,
                    missionId,
                    rewards: result.rewards
                });
            } else {
                await this._sendErrorMessage(interaction, result.error);

                logger.warn('Mission claim failed', {
                    userId,
                    missionId,
                    error: result.error
                });
            }

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'mission_claim',
                customId: interaction.customId
            });
            return true;
        }
    }

    /**
     * Obtiene las misiones activas del usuario
     * @param {string} userId - Discord user ID
     * @returns {Promise<Array>} - Active missions
     */
    async getActiveMissions(userId) {
        try {
            const { data: userMissions, error } = await this.supabase
                .from('user_missions')
                .select(`
          *,
          mission:missions(*)
        `)
                .eq('user_id', userId)
                .eq('status', 'active')
                .gte('expires_at', new Date().toISOString());

            if (error) throw error;

            return userMissions || [];

        } catch (error) {
            logger.errorWithContext('Failed to get active missions', error, { userId });
            return [];
        }
    }

    /**
     * Obtiene las misiones completadas del usuario
     * @param {string} userId - Discord user ID
     * @returns {Promise<Array>} - Completed missions
     */
    async getCompletedMissions(userId) {
        try {
            const { data: userMissions, error } = await this.supabase
                .from('user_missions')
                .select(`
          *,
          mission:missions(*)
        `)
                .eq('user_id', userId)
                .in('status', ['completed', 'claimed'])
                .order('completed_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            return userMissions || [];

        } catch (error) {
            logger.errorWithContext('Failed to get completed missions', error, { userId });
            return [];
        }
    }

    /**
     * Verifica si el usuario puede reclamar una misión
     * @param {string} userId - Discord user ID
     * @param {string} missionId - Mission ID
     * @returns {Promise<Object>} - { canClaim: boolean, reason: string }
     */
    async canClaimMission(userId, missionId) {
        try {
            const { data: userMission, error } = await this.supabase
                .from('user_missions')
                .select(`
          *,
          mission:missions(*)
        `)
                .eq('user_id', userId)
                .eq('mission_id', missionId)
                .single();

            if (error || !userMission) {
                return { canClaim: false, reason: 'Misión no encontrada' };
            }

            if (userMission.status === 'claimed') {
                return { canClaim: false, reason: 'Ya reclamaste esta recompensa' };
            }

            if (userMission.status !== 'completed') {
                return { canClaim: false, reason: 'Misión no completada' };
            }

            // Check expiration
            if (new Date(userMission.expires_at) < new Date()) {
                return { canClaim: false, reason: 'Misión expirada' };
            }

            return { canClaim: true, mission: userMission };

        } catch (error) {
            logger.errorWithContext('Error checking claim eligibility', error, { userId, missionId });
            return { canClaim: false, reason: 'Error al verificar' };
        }
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    /**
     * Envía mensaje de éxito
     * @private
     */
    async _sendSuccessMessage(interaction, result) {
        const { mission, rewards } = result;

        const rewardsList = [];
        if (rewards.xp) rewardsList.push(`✨ ${rewards.xp} XP`);
        if (rewards.money) rewardsList.push(`💵 $${rewards.money.toLocaleString()}`);

        const message = `🎉 **¡Recompensa Reclamada!**\n\n` +
            `**Misión:** ${mission.name}\n` +
            `**Has recibido:**\n${rewardsList.join('\n')}`;

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(message);
        } else {
            await interaction.reply({ content: message, ephemeral: true });
        }
    }

    /**
     * Envía mensaje de error
     * @private
     */
    async _sendErrorMessage(interaction, errorMsg) {
        const message = `❌ **Error al reclamar recompensa**\n\n${errorMsg}`;

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(message);
        } else {
            await interaction.reply({ content: message, ephemeral: true });
        }
    }
}

module.exports = MissionClaimHandler;
