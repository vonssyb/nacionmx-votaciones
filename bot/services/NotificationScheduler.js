/**
 * NotificationScheduler - Cron jobs for scheduled notifications
 * Fase 3, Item #7: Notificaciones Inteligentes
 */

const cron = require('node-cron');
const logger = require('./Logger');
const templates = require('./NotificationTemplates');

class NotificationScheduler {
    constructor(notificationService, supabase, client) {
        this.ns = notificationService;
        this.supabase = supabase;
        this.client = client;

        this.setupSchedules();
        logger.info('NotificationScheduler initialized');
    }

    /**
     * Setup all cron schedules
     */
    setupSchedules() {
        // Weekly summary: Every Sunday at 8 PM (Mexico City time)
        cron.schedule('0 20 * * 0', () => {
            logger.info('Running weekly summary cron job');
            this.sendWeeklySummaries();
        }, {
            timezone: "America/Mexico_City"
        });

        // Payment reminders: Every day at 9 AM
        cron.schedule('0 9 * * *', () => {
            logger.info('Running payment reminders cron job');
            this.checkPaymentReminders();
        }, {
            timezone: "America/Mexico_City"
        });

        // Debt check: Every 6 hours
        cron.schedule('0 */6 * * *', () => {
            logger.info('Running debt check cron job');
            this.checkDebtLevels();
        }, {
            timezone: "America/Mexico_City"
        });

        // Investment reminders: Every day at 6 PM
        cron.schedule('0 18 * * *', () => {
            logger.info('Running investment reminders cron job');
            this.checkInvestmentsMaturingSoon();
        }, {
            timezone: "America/Mexico_City"
        });

        logger.info('All cron schedules configured');
    }

    /**
     * Send weekly summaries to all users
     */
    async sendWeeklySummaries() {
        try {
            // Get all unique users with debit cards
            const { data: users, error } = await this.supabase
                .from('debit_cards')
                .select('discord_user_id')
                .eq('status', 'active');

            if (error) throw error;

            const uniqueUsers = [...new Set(users.map(u => u.discord_user_id))];
            logger.info(`Sending weekly summaries to ${uniqueUsers.length} users`);

            let successCount = 0;
            let errorCount = 0;

            for (const userId of uniqueUsers) {
                try {
                    // Check preferences
                    const prefs = await this.ns.getUserPreferences(userId);
                    if (!prefs.weekly_summary) continue;

                    // Get weekly stats
                    const { data: stats, error: statsError } = await this.supabase
                        .rpc('get_weekly_stats', { p_user_id: userId });

                    if (statsError) throw statsError;

                    // Skip if no activity
                    if (stats.spent === 0 && stats.received === 0) continue;

                    // Send DM
                    const user = await this.client.users.fetch(userId);
                    await user.send(templates.weeklySummary(stats));

                    // Log notification
                    await this.supabase.rpc('log_notification', {
                        p_user_id: userId,
                        p_type: 'weekly_summary',
                        p_content: stats
                    });

                    successCount++;

                } catch (userError) {
                    logger.errorWithContext('Error sending weekly summary', userError, { userId });
                    errorCount++;
                }
            }

            logger.info(`Weekly summaries sent: ${successCount} success, ${errorCount} errors`);

        } catch (error) {
            logger.errorWithContext('Error in sendWeeklySummaries', error);
        }
    }

    /**
     * Check and send payment reminders for due payments
     */
    async checkPaymentReminders() {
        try {
            // Find credit cards with payments due tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const { data: cards, error } = await this.supabase
                .from('credit_cards')
                .select('*')
                .eq('status', 'active')
                .gt('current_balance', 0);

            if (error) throw error;

            logger.info(`Checking payment reminders for ${cards.length} credit cards`);

            for (const card of cards) {
                try {
                    // Check preferences
                    const prefs = await this.ns.getUserPreferences(card.discord_user_id);
                    if (!prefs.payment_reminders) continue;

                    // Send reminder
                    const user = await this.client.users.fetch(card.discord_user_id);
                    await user.send(templates.paymentReminder({
                        amount: card.current_balance,
                        dueDate: tomorrowStr,
                        concept: `Pago tarjeta ${card.card_type}`
                    }));

                    // Log
                    await this.supabase.rpc('log_notification', {
                        p_user_id: card.discord_user_id,
                        p_type: 'payment_reminder',
                        p_content: { card_id: card.id, amount: card.current_balance }
                    });

                } catch (userError) {
                    logger.errorWithContext('Error sending payment reminder', userError, {
                        userId: card.discord_user_id
                    });
                }
            }

        } catch (error) {
            logger.errorWithContext('Error in checkPaymentReminders', error);
        }
    }

    /**
     * Check debt levels and send alerts
     */
    async checkDebtLevels() {
        try {
            const { data: cards, error } = await this.supabase
                .from('credit_cards')
                .select('*')
                .eq('status', 'active')
                .gt('current_balance', 0);

            if (error) throw error;

            logger.info(`Checking debt levels for ${cards.length} credit cards`);

            for (const card of cards) {
                try {
                    const percentage = (card.current_balance / card.credit_limit) * 100;

                    // Send alerts at 70%, 90%, and 95%
                    if (percentage >= 70) {
                        // Check if we already sent alert recently
                        const { data: recentAlert } = await this.supabase
                            .from('notification_log')
                            .select('id')
                            .eq('user_id', card.discord_user_id)
                            .eq('notification_type', 'debt_alert')
                            .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                            .limit(1);

                        if (recentAlert && recentAlert.length > 0) continue;

                        // Check preferences
                        const prefs = await this.ns.getUserPreferences(card.discord_user_id);
                        if (!prefs.debt_alerts) continue;

                        // Send alert
                        const user = await this.client.users.fetch(card.discord_user_id);
                        await user.send(templates.debtAlert(card, percentage));

                        // Log
                        await this.supabase.rpc('log_notification', {
                            p_user_id: card.discord_user_id,
                            p_type: 'debt_alert',
                            p_content: { card_id: card.id, percentage }
                        });

                        logger.info(`Sent debt alert to ${card.discord_user_id}: ${percentage.toFixed(1)}%`);
                    }

                } catch (userError) {
                    logger.errorWithContext('Error checking debt level', userError, {
                        userId: card.discord_user_id
                    });
                }
            }

        } catch (error) {
            logger.errorWithContext('Error in checkDebtLevels', error);
        }
    }

    /**
     * Check investments maturing soon
     */
    async checkInvestmentsMaturingSoon() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const { data: investments, error } = await this.supabase
                .from('investments')
                .select('*')
                .eq('status', 'active')
                .lte('maturity_date', tomorrow.toISOString());

            if (error) throw error;

            logger.info(`Checking ${investments?.length || 0} investments maturing soon`);

            for (const inv of investments || []) {
                try {
                    const user = await this.client.users.fetch(inv.discord_user_id);
                    await user.send(templates.investmentReminder({
                        profit: inv.payout_amount - inv.amount,
                        roi: ((inv.payout_amount - inv.amount) / inv.amount * 100).toFixed(2)
                    }));

                    await this.supabase.rpc('log_notification', {
                        p_user_id: inv.discord_user_id,
                        p_type: 'investment_reminder',
                        p_content: { investment_id: inv.id }
                    });

                } catch (userError) {
                    logger.errorWithContext('Error sending investment reminder', userError);
                }
            }

        } catch (error) {
            logger.errorWithContext('Error in checkInvestmentsMaturingSoon', error);
        }
    }
}

module.exports = NotificationScheduler;
