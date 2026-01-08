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
const ubService = new UnbelievableBoatService(UB_TOKEN, supabase);

class BillingService {
    constructor(client) {
        this.discordClient = client;
        this.ubService = ubService;
    }

    startCron() {
        console.log("Starting Billing Cron Job...");
        // Schedule: Every Sunday at 00:00 (Midnight)
        cron.schedule('0 0 * * 0', async () => {
            console.log("Running Weekly Billing Cycle...");
            await this.processWeeklyPayments();
        });

        // Schedule: Hourly check for pending transfers (Giros)
        cron.schedule('0 * * * *', async () => {
            await this.processPendingTransfers();
        });

        // Schedule: Overdraft Protection (Every 10 mins)
        cron.schedule('*/10 * * * *', async () => {
            await this.processOverdraftProtection();
        });
    }

    async processWeeklyPayments() {
        try {
            // 1. Fetch active cards with debt
            const { data: cards, error } = await supabase
                .from('credit_cards')
                .select('*, profiles(discord_id, full_name)')
                .eq('status', 'active')
                .gt('current_balance', 0);

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

        const debt = parseFloat(card.current_balance);
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

                this.notifyUser(discordId, `⚠️ **TARJETA BLOQUEADA**\nNo cubriste el pago mínimo de **$${minPayment.toLocaleString()}**.\nSe tomó tu saldo disponible ($${totalMoney.toLocaleString()}).\nTu tarjeta está **frozen** y generará intereses extra.`, false);
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
            current_balance: newDebt,
            last_payment_date: new Date().toISOString()
        }).eq('id', cardId);
    }

    async freezeCard(cardId) {
        await supabase.from('credit_cards').update({
            status: 'frozen',
            consecutive_missed_payments: 1 // Increment ideally
        }).eq('id', cardId);
    }

    async applyInterest(cardId, amount) {
        // Fetch current first to add
        const { data } = await supabase.from('credit_cards').select('current_balance').eq('id', cardId).single();
        if (data) {
            await supabase.from('credit_cards').update({
                current_balance: data.current_balance + amount
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

    /**
     * Get Debit Card for a user
     * @param {string} discordId 
     * @returns {Promise<{ data: any, error: any }>}
     */
    async getDebitCard(discordId) {
        // Query debit_cards via citizens table join if possible, or just look up by citizen linkage
        // Assuming debit_cards has a direct link or we go via citizens. 
        // Based on table structure, debit_cards usually links to citizen_id.
        // We need to resolve discordId -> citizen -> debit_card

        try {
            // 1. Get Citizen ID
            const { data: citizen } = await supabase
                .from('citizens')
                .select('id')
                .eq('discord_id', discordId)
                .limit(1)
                .maybeSingle();

            if (!citizen) return { data: null, error: 'Citizen not found' };

            // 2. Get Debit Card
            const { data: card, error } = await supabase
                .from('debit_cards')
                .select('*')
                .eq('citizen_id', citizen.id)
                .eq('status', 'ACTIVE') // Only active cards
                .limit(1)
                .maybeSingle();

            return { data: card, error };
        } catch (err) {
            console.error('Error fetching debit card:', err);
            return { data: null, error: err };
        }
    }


    async processPendingTransfers() {
        console.log('🔄 Checking for pending giro transfers...');
        try {
            const now = new Date().toISOString();

            // Fetch matured transfers
            const { data: transfers, error } = await supabase
                .from('pending_transfers')
                .select('*')
                .eq('status', 'PENDING')
                .lte('release_date', now);

            if (error) throw error;
            if (transfers && transfers.length > 0) {
                console.log(`💸 Processing ${transfers.length} matured transfers.`);

                for (const t of transfers) {
                    try {
                        // Determine Method (Cash vs Bank)
                        // All database supported types lead to Debit (Bank)
                        const currency = 'bank';

                        // Check schema compatibility (receiver_id vs to_user_id)
                        // We use NUCLEAR FIX names: receiver_id
                        const targetId = t.receiver_id || t.to_user_id;

                        if (!targetId) {
                            console.error(`Transfer ${t.id} has no receiver ID.`);
                            continue;
                        }

                        // Add funds to receiver
                        const title = (t.metadata && t.metadata.subtype === 'giro') ? 'GIRO RECIBIDO' : 'TRANSFERENCIA RECIBIDA';
                        await this.ubService.addMoney(GUILD_ID, targetId, parseFloat(t.amount), `${title} de ${t.sender_id}: ${t.reason}`, currency);

                        // Mark as COMPLETED
                        await supabase
                            .from('pending_transfers')
                            .update({ status: 'COMPLETED' })
                            .eq('id', t.id);

                        // Notify Receiver
                        this.notifyUser(targetId, `💰 **${title}**\nHas recibido **$${parseFloat(t.amount).toLocaleString()}** de <@${t.sender_id}>.\nConcepto: ${t.reason}`, true);

                    } catch (txError) {
                        console.error(`Error processing transfer ${t.id}:`, txError);
                    }
                }
            }
        } catch (err) {
            console.error('Error in processPendingTransfers:', err);
        }
    }

    // === OVERDRAFT PROTECTION (Saldo Negativo) ===
    async processOverdraftProtection() {
        // Runs every 10 minutes to fix negative cash balances
        // console.log("🛡️ Checking for negative balances...");
        try {
            // 1. Get all users with Active Debit Cards (Source of funds)
            const { data: cards } = await supabase
                .from('debit_cards')
                .select('discord_id, current_balance, id, card_number')
                .eq('status', 'ACTIVE')
                .gt('current_balance', 0); // Only those with money

            if (!cards || cards.length === 0) return;

            // Batch check balances? UB doesn't support batch well, loop for now.
            // Limit to avoid rate limits if many users.

            for (const card of cards) {
                const userId = card.discord_id;
                try {
                    const balance = await ubService.getUserBalance(GUILD_ID, userId);
                    const cash = balance.cash; // Can be negative in UnbelievaBoat

                    if (cash < 0) {
                        const debt = Math.abs(cash);
                        const coverage = Math.min(debt, card.current_balance);

                        if (coverage > 0) {
                            console.log(`🛡️ Covering negative balance for ${userId}: Needs $${debt}, Covering $${coverage}`);

                            // 1. Withdraw from Debit (DB)
                            const newCardBalance = card.current_balance - coverage;
                            await supabase.from('debit_cards').update({ current_balance: newCardBalance }).eq('id', card.id);

                            // 2. Add to Cash (UB)
                            await ubService.addMoney(GUILD_ID, userId, coverage, '🛡️ Protección Saldo Negativo (Auto-Cobertura)', 'cash');

                            // 3. Log
                            await supabase.from('debit_transactions').insert({
                                debit_card_id: card.id,
                                discord_user_id: userId,
                                amount: -coverage,
                                transaction_type: 'withdrawal',
                                description: 'Protección Saldo Negativo (Auto de Débito a Efectivo)'
                            });

                            // 4. Notify
                            this.notifyUser(userId, `🛡️ **Protección de Saldo Activada**\nTu efectivo estaba en negativo ($${cash.toLocaleString()}).\nSe tomaron **$${coverage.toLocaleString()}** de tu Tarjeta de Débito para cubrirlo automáticamente.`, true);
                        }
                    }
                } catch (e) {
                    console.error(`Error checking overdraft for ${userId}:`, e.message);
                }
            }

        } catch (err) {
            console.error("Error in processOverdraftProtection:", err);
        }
    }
}

module.exports = BillingService;
