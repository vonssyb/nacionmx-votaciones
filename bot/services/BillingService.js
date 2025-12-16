const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const UnbelievableBoatService = require('./UnbelievaBoatService');

// Use existing Env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST be service role to read all cards
const UB_TOKEN = process.env.UNBELIEVABOAT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!UB_TOKEN) {
    console.warn("WARNING: UNBELIEVABOAT_TOKEN not found. Economy features will fail.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ubService = new UnbelievableBoatService(UB_TOKEN);

class BillingService {
    constructor(client) {
        this.discordClient = client;
    }

    startCron() {
        console.log("Starting Billing Cron Job...");
        // Schedule: Every Sunday at 00:00 (Midnight)
        cron.schedule('0 0 * * 0', async () => {
            console.log("Running Weekly Billing Cycle...");
            await this.processWeeklyPayments();
        });
    }

    async processWeeklyPayments() {
        try {
            // 1. Fetch active cards with debt
            const { data: cards, error } = await supabase
                .from('credit_cards')
                .select('*, profiles(discord_id, full_name)')
                .eq('status', 'ACTIVE')
                .gt('current_debt', 0);

            if (error) throw error;

            console.log(`Processing payments for ${cards.length} cards.`);

            for (const card of cards) {
                await this.processSingleCard(card);
            }

        } catch (err) {
            console.error("Critical Billing Error:", err);
        }
    }

    async processSingleCard(card) {
        const discordId = card.profiles?.discord_id;
        if (!discordId) {
            console.warn(`Card ${card.id} has no linked Discord ID.`);
            return;
        }

        const debt = parseFloat(card.current_debt);
        const minPayment = debt * 0.25; // 25% Weekly minimum

        try {
            // 2. Check Balance
            const balanceData = await ubService.getUserBalance(GUILD_ID, discordId);
            const totalMoney = balanceData.total || (balanceData.cash + balanceData.bank);

            console.log(`User ${card.profiles.full_name} (${discordId}) - Debt: ${debt}, Money: ${totalMoney}`);

            if (totalMoney >= minPayment) {
                // HAPPY PATH: User has enough for minimum
                const amountToCharge = minPayment; // Only charge minimum automatically? Or full debt? 
                // Let's charge minimum to keep it safe, OR full if they have it...
                // User requirement: "Cobra solo, quita dinero automático... Si no alcanza -> Bloqueo"
                // Let's prioritize paying off FULL debt if possible, otherwise Minimum.

                let chargeAmount = (totalMoney >= debt) ? debt : minPayment;

                const result = await ubService.removeMoney(GUILD_ID, discordId, chargeAmount, `Pago Automático Tarjeta NMX (${card.level_name})`);

                if (result.success) {
                    // Update DB
                    await this.recordPayment(card.id, discordId, chargeAmount, 'SUCCESS', 'PAYMENT', result.newBalance);
                    await this.updateCardDebt(card.id, debt - chargeAmount);

                    this.notifyUser(discordId, `✅ **Pago Automático Exitoso**\nSe han descontado **$${chargeAmount.toLocaleString()}** de tu cuenta.\nTu tarjeta sigue **ACTIVA**.`, true);
                } else {
                    // Failed to remove money (API error?)
                    this.handleFailedPayment(card, discordId, "API Error during charge");
                }

            } else {
                // SAD PATH: User is BROKE
                // 1. Take whatever they have (if > 0)
                if (totalMoney > 0) {
                    await ubService.removeMoney(GUILD_ID, discordId, totalMoney, `Pago Parcial Forzoso NMX`);
                    await this.recordPayment(card.id, discordId, totalMoney, 'SUCCESS', 'PARTIAL_PAYMENT', {});
                    await this.updateCardDebt(card.id, debt - totalMoney);
                }

                // 2. Freeze Card
                await this.freezeCard(card.id);

                // 3. Apply Interest (Penalty)
                const interestRate = (card.interest_rate || 5) / 100;
                const penalty = (debt - totalMoney) * interestRate;
                await this.applyInterest(card.id, penalty);

                this.notifyUser(discordId, `⚠️ **TARJETA BLOQUEADA**\nNo cubriste el pago mínimo de **$${minPayment.toLocaleString()}**.\nSe tomó tu saldo disponible ($${totalMoney.toLocaleString()}).\nTu tarjeta está **FROZEN** y generará intereses extra.`, false);
            }

        } catch (err) {
            console.error(`Error processing card ${card.id}:`, err);
        }
    }

    async recordPayment(cardId, discordId, amount, status, type, metadata) {
        await supabase.from('transaction_logs').insert({
            card_id: cardId,
            discord_user_id: discordId,
            amount: amount,
            status: status,
            type: type,
            metadata: metadata
        });
    }

    async updateCardDebt(cardId, newDebt) {
        await supabase.from('credit_cards').update({
            current_debt: newDebt,
            last_payment_date: new Date().toISOString()
        }).eq('id', cardId);
    }

    async freezeCard(cardId) {
        await supabase.from('credit_cards').update({
            status: 'FROZEN',
            consecutive_missed_payments: 1 // Increment ideally
        }).eq('id', cardId);
    }

    async applyInterest(cardId, amount) {
        // Fetch current first to add
        const { data } = await supabase.from('credit_cards').select('current_debt').eq('id', cardId).single();
        if (data) {
            await supabase.from('credit_cards').update({
                current_debt: data.current_debt + amount
            }).eq('id', cardId);

            // Log interest
            // this.recordPayment(..., amount, 'SUCCESS', 'INTEREST', ...) simplified
        }
    }

    async notifyUser(discordId, message, isGood) {
        try {
            const user = await this.discordClient.users.fetch(discordId);
            if (user) {
                const embed = {
                    title: isGood ? "Banco Nación MX" : "🚫 Aviso de Cobranza",
                    description: message,
                    color: isGood ? 0x00FF00 : 0xFF0000,
                    timestamp: new Date()
                };
                await user.send({ embeds: [embed] });
            }
        } catch (e) {
            console.error("Could not DM user:", discordId);
        }
    }
}

module.exports = BillingService;
