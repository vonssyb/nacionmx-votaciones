/**
 * NotificationService - Smart notification system with queuing and batching
 * Fase 3, Item #7: Notificaciones Inteligentes
 */

const logger = require('./Logger');

class NotificationService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.queue = new Map(); // userId -> [notifications]
        this.batchInterval = 30 * 60 * 1000; // 30 minutes

        // Start batch processor
        this.startBatchProcessor();

        logger.info('NotificationService initialized');
    }

    /**
     * Queue a notification for batching
     * @param {string} userId - Discord user ID
     * @param {string} type - Notification type
     * @param {object} data - Notification data
     */
    async queueNotification(userId, type, data) {
        // Check user preferences
        const prefs = await this.getUserPreferences(userId);

        if (!this.shouldSendNotification(type, prefs)) {
            logger.debug(`Notification ${type} blocked by user preferences for ${userId}`);
            return;
        }

        if (!this.queue.has(userId)) {
            this.queue.set(userId, []);
        }

        this.queue.get(userId).push({
            type,
            data,
            timestamp: Date.now()
        });

        logger.debug(`Queued ${type} notification for user ${userId}`);
    }

    /**
     * Start periodic batch processor
     */
    startBatchProcessor() {
        setInterval(() => {
            this.processBatch();
        }, this.batchInterval);

        logger.info(`Batch processor started (interval: ${this.batchInterval}ms)`);
    }

    /**
     * Process all queued notifications
     */
    async processBatch() {
        const processedCount = this.queue.size;

        if (processedCount === 0) {
            return;
        }

        logger.info(`Processing batch: ${processedCount} users with pending notifications`);

        for (const [userId, notifications] of this.queue.entries()) {
            if (notifications.length === 0) continue;

            try {
                // Group by type
                const grouped = this.groupNotifications(notifications);

                // Send grouped message
                await this.sendGroupedNotification(userId, grouped);

                // Log to database
                await this.logNotifications(userId, grouped);

                // Clear queue for this user
                this.queue.set(userId, []);

            } catch (error) {
                logger.errorWithContext('Error processing batch for user', error, { userId });
            }
        }

        logger.info(`Batch processed: ${processedCount} users`);
    }

    /**
     * Group notifications by type
     * @param {Array} notifications
     * @returns {Object} Grouped notifications
     */
    groupNotifications(notifications) {
        const groups = {};

        for (const notif of notifications) {
            if (!groups[notif.type]) {
                groups[notif.type] = [];
            }
            groups[notif.type].push(notif.data);
        }

        return groups;
    }

    /**
     * Send grouped notification to user via DM
     * @param {string} userId
     * @param {Object} grouped
     */
    async sendGroupedNotification(userId, grouped) {
        try {
            const user = await this.client.users.fetch(userId);

            // Build message content
            const content = this.buildGroupedMessage(grouped);

            await user.send(content);

            logger.info(`Sent grouped notification to ${userId}`, {
                types: Object.keys(grouped),
                count: Object.values(grouped).flat().length
            });

        } catch (error) {
            logger.errorWithContext('Failed to send DM', error, { userId });
        }
    }

    /**
     * Build message from grouped notifications
     * @param {Object} grouped
     * @returns {Object} Discord message object
     */
    buildGroupedMessage(grouped) {
        const embeds = [];

        for (const [type, items] of Object.entries(grouped)) {
            if (type === 'transaction' && items.length > 1) {
                // Multiple transactions - group them
                const total = items.reduce((sum, item) => sum + item.amount, 0);
                embeds.push({
                    title: `💰 ${items.length} Transacciones Recientes`,
                    description: `Total: $${total.toLocaleString()}`,
                    color: total >= 0 ? 0x00FF00 : 0xFF0000,
                    fields: items.slice(0, 5).map(item => ({
                        name: item.type,
                        value: `$${item.amount.toLocaleString()}`,
                        inline: true
                    })),
                    footer: {
                        text: items.length > 5 ? `+${items.length - 5} más` : ''
                    }
                });
            } else {
                // Single or other types - show individually
                for (const item of items) {
                    embeds.push(this.buildSingleEmbed(type, item));
                }
            }
        }

        return { embeds };
    }

    /**
     * Build single notification embed
     */
    buildSingleEmbed(type, data) {
        // Default embed structure
        return {
            title: this.getNotificationTitle(type),
            description: this.getNotificationDescription(type, data),
            color: this.getNotificationColor(type),
            timestamp: new Date()
        };
    }

    /**
     * Get user notification preferences
     */
    async getUserPreferences(userId) {
        try {
            const { data, error } = await this.supabase
                .rpc('get_notification_prefs', { p_user_id: userId });

            if (error) throw error;

            return data || {
                weekly_summary: true,
                payment_reminders: true,
                debt_alerts: true,
                transaction_grouping: true
            };
        } catch (error) {
            logger.errorWithContext('Error fetching notification preferences', error, { userId });
            return {}; // Return defaults
        }
    }

    /**
     * Check if notification should be sent based on preferences
     */
    shouldSendNotification(type, prefs) {
        const typeMap = {
            'weekly_summary': prefs.weekly_summary,
            'payment_reminder': prefs.payment_reminders,
            'debt_alert': prefs.debt_alerts,
            'transaction': prefs.transaction_grouping
        };

        return typeMap[type] !== false;
    }

    /**
     * Log notifications to database
     */
    async logNotifications(userId, grouped) {
        try {
            for (const [type, items] of Object.entries(grouped)) {
                await this.supabase
                    .rpc('log_notification', {
                        p_user_id: userId,
                        p_type: type,
                        p_content: { items }
                    });
            }
        } catch (error) {
            logger.errorWithContext('Error logging notifications', error, { userId });
        }
    }

    // Helper methods for embeds
    getNotificationTitle(type) {
        const titles = {
            transaction: '💰 Nueva Transacción',
            payment_reminder: '🔔 Recordatorio de Pago',
            debt_alert: '⚠️ Alerta de Deuda',
            weekly_summary: '📊 Resumen Semanal'
        };
        return titles[type] || '📬 Notificación';
    }

    getNotificationDescription(type, data) {
        // Implement specific descriptions per type
        return JSON.stringify(data);
    }

    getNotificationColor(type) {
        const colors = {
            transaction: 0xFFD700,
            payment_reminder: 0x00BFFF,
            debt_alert: 0xFF4500,
            weekly_summary: 0x32CD32
        };
        return colors[type] || 0x808080;
    }
}

module.exports = NotificationService;
