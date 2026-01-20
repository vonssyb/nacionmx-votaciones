/**
 * @module handlers/shared/voting
 * @description Maneja el sistema de votación para sesiones
 * 
 * Este módulo gestiona:
 * - Botones de votación (vote_yes_, vote_late_, vote_no_)
 * - Registro y actualización de votos
 * - Conteo de votos con roles especiales
 * - Actualización de embeds con resultados
 */

const { EmbedBuilder } = require('discord.js');
const logger = require('../../../services/Logger');
const ErrorHandler = require('../../../utils/errorHandler');

class VotingHandler {
    constructor(supabase) {
        this.supabase = supabase;
        this.STAFF_ROLE_ID = '1412882245735420006'; // Junta Directiva
    }

    /**
     * Maneja las interacciones de botones de votación
     * @param {Interaction} interaction - Discord button interaction
     * @param {Client} client - Discord client
     * @returns {Promise<boolean>} - True if handled
     */
    async handleInteraction(interaction, client) {
        try {
            if (!interaction.isButton()) return false;

            const { customId, user, guild } = interaction;

            // Check if this is a voting button
            if (!customId.startsWith('vote_')) {
                return false;
            }

            const [action, voteType, sessionId] = customId.split('_');

            if (!sessionId) {
                await interaction.reply({
                    content: '❌ ID de sesión inválido.',
                    ephemeral: true
                });
                return true;
            }

            logger.info('Processing vote', { userId: user.id, voteType, sessionId });

            // Validate session
            const session = await this._getSession(sessionId);
            if (!session || session.status !== 'active') {
                await interaction.reply({
                    content: '❌ Esta votación ya no está activa.',
                    ephemeral: true
                });
                return true;
            }

            // Register or update vote
            await this._registerVote(user.id, sessionId, voteType);

            // Send confirmation
            await this._sendConfirmation(interaction, voteType);

            // Update vote counts in embed
            await this._updateVoteEmbed(interaction, sessionId);

            logger.info('Vote processed successfully', {
                userId: user.id,
                voteType,
                sessionId
            });

            return true;

        } catch (error) {
            await ErrorHandler.handle(error, interaction, {
                operation: 'voting',
                customId: interaction.customId
            });
            return true;
        }
    }

    /**
     * Obtiene los resultados de una votación
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} - Vote counts
     */
    async getVoteResults(sessionId) {
        try {
            const { data: votes, error } = await this.supabase
                .from('session_vote_participants')
                .select('user_id, vote_type')
                .eq('session_id', sessionId);

            if (error) throw error;

            const yesVotes = votes?.filter(v => v.vote_type === 'yes') || [];
            const lateVotes = votes?.filter(v => v.vote_type === 'late') || [];
            const noVotes = votes?.filter(v => v.vote_type === 'no') || [];

            return {
                yes: yesVotes.length,
                late: lateVotes.length,
                no: noVotes.length,
                total: votes?.length || 0,
                votes: votes || []
            };

        } catch (error) {
            logger.errorWithContext('Error getting vote results', error, { sessionId });
            return { yes: 0, late: 0, no: 0, total: 0, votes: [] };
        }
    }

    /**
     * Cuenta votos de staff/directiva
     * @param {Guild} guild - Discord guild
     * @param {Array} userIds - User IDs to check
     * @returns {Promise<number>} - Staff vote count
     */
    async countStaffVotes(guild, userIds) {
        let staffCount = 0;

        await Promise.all(userIds.map(async (userId) => {
            try {
                const member = await guild.members.fetch(userId);
                if (member.roles.cache.has(this.STAFF_ROLE_ID)) {
                    staffCount++;
                }
            } catch (e) {
                // User might have left server
            }
        }));

        return staffCount;
    }

    /**
     * Verifica si un usuario ya votó
     * @param {string} userId - Discord user ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object|null>} - Existing vote or null
     */
    async getUserVote(userId, sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('session_vote_participants')
                .select('*')
                .eq('session_id', sessionId)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) throw error;
            return data;

        } catch (error) {
            logger.errorWithContext('Error getting user vote', error, { userId, sessionId });
            return null;
        }
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    /**
     * Obtiene una sesión de votación
     * @private
     */
    async _getSession(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('session_votes')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            logger.errorWithContext('Error getting session', error, { sessionId });
            return null;
        }
    }

    /**
     * Registra o actualiza un voto
     * @private
     */
    async _registerVote(userId, sessionId, voteType) {
        const existingVote = await this.getUserVote(userId, sessionId);

        if (existingVote) {
            // Update existing vote
            const { error } = await this.supabase
                .from('session_vote_participants')
                .update({ vote_type: voteType })
                .eq('id', existingVote.id);

            if (error) throw error;

            logger.info('Vote updated', { userId, sessionId, voteType });
        } else {
            // Create new vote
            const { error } = await this.supabase
                .from('session_vote_participants')
                .insert({
                    session_id: sessionId,
                    user_id: userId,
                    vote_type: voteType
                });

            if (error) throw error;

            logger.info('Vote registered', { userId, sessionId, voteType });
        }
    }

    /**
     * Envía confirmación al usuario
     * @private
     */
    async _sendConfirmation(interaction, voteType) {
        const messages = {
            yes: 'Participaré',
            late: 'Con retraso',
            no: 'No podré'
        };

        const message = `✅ Voto registrado: **${messages[voteType] || voteType}**`;

        await interaction.reply({
            content: message,
            ephemeral: true
        });
    }

    /**
     * Actualiza el embed de votación
     * @private
     */
    async _updateVoteEmbed(interaction, sessionId) {
        try {
            const results = await this.getVoteResults(sessionId);

            // Get staff votes
            const yesVoters = results.votes
                .filter(v => v.vote_type === 'yes')
                .map(v => v.user_id);

            const staffYesCount = await this.countStaffVotes(interaction.guild, yesVoters);

            // Try to update the original message
            // Note: This requires storing the message ID when creating the vote
            // For now, we just log the results
            logger.info('Vote results updated', {
                sessionId,
                yes: results.yes,
                late: results.late,
                no: results.no,
                staffYes: staffYesCount
            });

        } catch (error) {
            logger.warn('Could not update vote embed', { error: error.message, sessionId });
        }
    }

    /**
     * Crea un embed de resultados de votación
     * @param {Object} results - Vote results
     * @param {number} staffYesCount - Staff yes votes
     * @returns {EmbedBuilder} - Vote results embed
     */
    createResultsEmbed(results, staffYesCount = 0) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Resultados de Votación')
            .setColor(0x00AE86)
            .addFields(
                { name: '✅ Participarán', value: `${results.yes}`, inline: true },
                { name: '⏰ Con retraso', value: `${results.late}`, inline: true },
                { name: '❌ No podrán', value: `${results.no}`, inline: true }
            );

        if (staffYesCount > 0) {
            embed.addFields({
                name: '👔 Staff confirmado',
                value: `${staffYesCount}`,
                inline: true
            });
        }

        embed.addFields({
            name: '📈 Total de votos',
            value: `${results.total}`,
            inline: true
        });

        return embed;
    }
}

module.exports = VotingHandler;
