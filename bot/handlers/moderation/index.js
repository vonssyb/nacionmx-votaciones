/**
 * @module handlers/moderation/index
 * @description Main Orchestrator for Moderation System
 * Routes interactions to specific sub-handlers or legacy handler
 */

const logger = require('../../services/Logger');

// Sub-Handlers
const VoiceManager = require('./voice/manager');
const VotingHandler = require('../shared/voting/handler'); // Voting is shared but sometimes called from mod context? Usually 'vote_'
// Note: Voting is currently in shared/voting/handler.js and Economy Orchestrator handles 'vote_'.
// We should decide if Moderation also handles 'vote_' or if Economy handles it exclusively.
// Given 'vote_' prefix is generic, it might be better handled in ONE place or both if distinct.
// For now, let's let Economy handle it if it was primarily economy-based (investment votes?), 
// but wait, 'vote_' is usually for "Suggestions" or "Polls".
// Let's check where 'vote_' is handled in legacyModerationHandler.

// Legacy Fallback
const { handleModerationLegacy } = require('../legacyModerationHandler');

/**
 * Main Entry Point for Moderation Interactions
 * @param {Interaction} interaction 
 * @param {Client} client 
 * @param {SupabaseClient} supabase 
 */
async function handleModerationInteraction(interaction, client, supabase) {
    const customId = interaction.customId;

    try {
        // 1. SANCTION APPROVALS (Phase 2.4 - Two-Man Rule)
        // Handled in legacyModerationHandler currently, BUT refactored to use SanctionService.
        // We haven't extracted the 'interaction handler' part out of legacy yet into a standalone file.
        // 'approve_sancion_' logic is still inside legacyModerationHandler.js (even if it calls Service).
        // Ideally, we should extract it to handlers/moderation/sanctions/approve.js
        // For now, we fall back to legacy to keep it working as per Phase 2.4 deliverable.

        // 2. VOICE SYSTEM (Phase 2.1)
        if (customId && customId.startsWith('vc_')) {
            const { handleVoiceInteraction } = require('./voice/manager');
            const handled = await handleVoiceInteraction(interaction, client, supabase);
            if (handled) return;
        }

        // 3. VOTING SYSTEM
        if (customId && customId.startsWith('vote_')) {
            try {
                const votingHandler = new VotingHandler(supabase);
                const handled = await votingHandler.handleInteraction(interaction, client);
                if (handled) return;
            } catch (voteErr) {
                logger.errorWithContext('Voting Handler Error', voteErr);
            }
        }

        // 3. LEGACY FALLBACK
        await handleModerationLegacy(interaction, client, supabase);

    } catch (error) {
        logger.errorWithContext('Moderation Orchestrator Error', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error interno en el sistema de moderación.', ephemeral: true }).catch(() => { });
        }
    }
}

module.exports = { handleModerationInteraction };
