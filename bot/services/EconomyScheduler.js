const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const logger = require('./Logger');

class EconomyScheduler {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.LOG_CHANNEL_ID = '1452346918620500041'; // Logs Banco
    }

    start() {
        logger.info('Economy Scheduler Initialized');

        // 1. Weekly Credit Card Interest (Sunday 23:55)
        cron.schedule('55 23 * * 0', async () => {
            await this.processCreditCardInterests();
        });

        // 2. Daily Loan Check (09:00 AM)
        cron.schedule('0 9 * * *', async () => {
            await this.checkOverdueLoans();
        });

        // 3. Random Server Events (Every 6 hours check for new event)
        cron.schedule('0 */6 * * *', async () => {
            await this.triggerRandomEvent();
        });

        // 4. Weekly Fiscal Check (Companies) - Placeholder for future taxes

        logger.info('All economy schedulers registered successfully');
    }

    async triggerRandomEvent() {
        logger.info('Checking for random event trigger...');
        try {
            const EventService = require('./EventService');
            const EVENT_CHANNEL_ID = process.env.EVENT_CHANNEL_ID || '1452346918620500041'; // Default to banco logs

            // 50% chance to trigger an event when this runs
            if (Math.random() < 0.5) {
                await EventService.startRandomEvent(this.client, EVENT_CHANNEL_ID);
                logger.info('Random event started');
            } else {
                logger.info('No event triggered this time');
            }
        } catch (error) {
            logger.errorWithContext('Error triggering random event', error);
        }
    }

    async processCreditCardInterests() {
        logger.info('Processing Weekly Credit Card Interests...');
        try {
            // Fetch active cards with debt
            const { data: cards, error } = await this.supabase
                .from('credit_cards')
                .select('*, citizens(full_name)')
                .gt('current_balance', 0)
                .neq('status', 'frozen'); // Don't charge frozen cards? Or yes? Usually yes, penalties. Let's charge active/active_debt.

            if (error) throw error;
            if (!cards || cards.length === 0) return logger.info('No cards with debt to charge.');

            let totalCharged = 0;
            let report = '';

            for (const card of cards) {
                // Calculate Interest
                // interest_rate is percentage (e.g. 15 for 15%)
                const interest = card.current_balance * (card.interest_rate / 100);

                if (interest > 0) {
                    const newBalance = card.current_balance + interest;

                    // Update DB
                    await this.supabase
                        .from('credit_cards')
                        .update({
                            current_balance: newBalance,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', card.id);

                    totalCharged += interest;
                    report += `• **${card.card_type}** (<@${card.discord_id}>): +$${interest.toLocaleString()} (Deuda: $${newBalance.toLocaleString()})\n`;
                }
            }

            // Log Summary
            const channel = await this.client.channels.fetch(this.LOG_CHANNEL_ID).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('📉 Corte Semanal: Intereses Aplicados')
                    .setColor('#E74C3C')
                    .setDescription(`Se han procesado los intereses de las tarjetas de crédito.\n\n💰 **Total Cargado:** $${totalCharged.toLocaleString()}\n💳 **Tarjetas Afectadas:** ${cards.length}\n\n**Detalle:**\n${report.slice(0, 4000)}`) // Limit discord 4096
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
            }

            logger.info(`Charged interests to ${cards.length} cards. Total: $${totalCharged}`);

        } catch (error) {
            logger.errorWithContext('Error processing interests', error);
        }
    }

    async checkOverdueLoans() {
        logger.info('Checking Overdue Loans...');
        try {
            const today = new Date().toISOString();

            // Find loans that are 'active' but due_date < now
            const { data: loans, error } = await this.supabase
                .from('loans')
                .select('*')
                .eq('status', 'active')
                .lt('due_date', today);

            if (error) throw error;
            if (!loans || loans.length === 0) return;

            for (const loan of loans) {
                // Mark as overdue
                await this.supabase
                    .from('loans')
                    .update({ status: 'overdue' })
                    .eq('id', loan.id);

                // Notify User logic here (omitted for brevity, or implemented cleanly)
                try {
                    const user = await this.client.users.fetch(loan.borrower_discord_id).catch(() => null);
                    if (user) user.send(`⚠️ **Préstamo Vencido**\nTu préstamo de $${loan.amount.toLocaleString()} ha vencido hoy. Por favor acude al banco para evitar embargos.`).catch(() => { });
                } catch (e) { }
            }

            // Log
            const channel = await this.client.channels.fetch(this.LOG_CHANNEL_ID).catch(() => null);
            if (channel && loans.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Préstamos Vencidos')
                    .setColor('#E67E22')
                    .setDescription(`Se han detectado **${loans.length}** préstamos vencidos hoy.`)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }

            logger.info(`Marked ${loans.length} loans as overdue.`);

        } catch (error) {
            logger.errorWithContext('Error checking loans', error);
        }
    }
}

module.exports = EconomyScheduler;
