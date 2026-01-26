/**
 * @module handlers/economy/index
 * @description Main Orchestrator for Economy System
 * Routes interactions to specific sub-handlers or legacy handler
 */

const logger = require('../../services/Logger');

// Sub-Handlers
const CompanyOrchestrator = require('./company/orchestrator');
const CasinoHandler = require('./casino/blackjack'); // Assuming single file for now
const MissionClaimHandler = require('./missions/claim');
const VotingHandler = require('../shared/voting/handler');
const GenericPaymentHandler = require('../shared/payments/generic');
const LicensePaymentHandler = require('./payments/licenses'); // If exists
const CreditPaymentHandler = require('./payments/credit'); // If exists

// Legacy Fallback
const { handleEconomyLegacy } = require('../legacyEconomyHandler');

/**
 * Main Entry Point for Economy Interactions
 * @param {Interaction} interaction 
 * @param {Client} client 
 * @param {SupabaseClient} supabase 
 */
async function handleEconomyInteraction(interaction, client, supabase) {
    const customId = interaction.customId;
    const commandName = interaction.commandName;

    try {
        // 1. COMPANY SYSTEM (Phase 2.3)
        // Handled via Client.services usually, but let's route here if needed
        // index_unified already has companyOrchestrator. We can re-use it.
        if (client.services && client.services.companyOrchestrator) {
            // Check if it looks like a company interaction
            if (customId && (
                customId.startsWith('company_') ||
                customId.startsWith('vehicle_') ||
                customId.startsWith('payroll_') ||
                customId.startsWith('pay_biz_debt_') ||
                customId.startsWith('withdraw_')
            )) {
                const handled = await client.services.companyOrchestrator.handleInteraction(interaction);
                if (handled) return;
            }
        }

        // 2. CASINO SYSTEM (Phase 2.1)
        if (customId && customId.startsWith('btn_bj_')) {
            // We need to instantiate or use static?
            // Casino code (blackjack.js) exports { handleBlackjack }
            const { handleBlackjack } = require('./casino/blackjack');
            const handled = await handleBlackjack(interaction, client, supabase);
            if (handled) return;
        }

        // 3. MISSIONS (Phase 2.1)
        if (customId && customId.startsWith('claim_mission_')) {
            const { handleClaimMission } = require('./missions/claim');
            const handled = await handleClaimMission(interaction, client, supabase);
            if (handled) return;
        }

        // 4. VOTING (Phase 2.1 - Shared)
        if (customId && customId.startsWith('vote_')) {
            const { handleVoting } = require('../shared/voting/handler');
            const handled = await handleVoting(interaction, client, supabase);
            if (handled) return;
        }

        // 5. PAYMENTS (Phase 2.2)
        // Generic Payments (pay_*)
        if (customId && (
            customId.startsWith('pay_') ||
            customId.startsWith('casino_pay_') ||
            customId.startsWith('store_pay_')
        )) {
            // Special check for pay_biz_debt which is company
            if (!customId.startsWith('pay_biz_debt_')) {
                const { handleGenericPayment } = require('../shared/payments/generic');
                const handled = await handleGenericPayment(interaction, client, supabase);
                if (handled) return;
            }
        }

        // STORE (Direct Service Call)
        if (customId && customId.startsWith('buy_item_')) {
            if (client.services && client.services.store) {
                await client.services.store.handleBuyButton(interaction);
                return;
            }
        }

        // License Payments
        if (customId && customId.startsWith('license_pay_')) {
            const LicensePaymentHandler = require('./payments/licenses');
            // Ensure services are available
            if (client.services && client.services.paymentProcessor) {
                const handler = new LicensePaymentHandler(client, supabase, client.services.paymentProcessor);
                const handled = await handler.handleInteraction(interaction);
                if (handled) return;
            } else {
                logger.error('PaymentProcessor service missing for License Payment');
            }
        }

        // Credit Payments
        if (customId && customId.startsWith('cred_pay_')) {
            const CreditPaymentHandler = require('./payments/credit');
            if (client.services && client.services.paymentProcessor) {
                const handler = new CreditPaymentHandler(client, supabase, client.services.paymentProcessor);
                const handled = await handler.handleInteraction(interaction);
                if (handled) return;
            }
        }


        // 6. LEGACY FALLBACK
        // If not handled by any new module, pass to legacy
        await handleEconomyLegacy(interaction, client, supabase);

    } catch (error) {
        logger.errorWithContext('Economy Orchestrator Error', error);
        // Try to reply if possible
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error interno en el sistema de economía.', ephemeral: true }).catch(() => { });
        }
    }
}

module.exports = { handleEconomyInteraction };
