const logger = require('./Logger');
// Handlers are in bot/handlers/Logger.js? Previous file had `require('./Logger')`. Service is in `bot/services`. So `../handlers/Logger` might be wrong if Logger is in services.
// Let's check imports. Original was `require('./Logger')` which means Logger.js is in `services/`.
// Let's assume Logger is in services based on original file.

const { EmbedBuilder } = require('discord.js');
const TranscriptService = require('./TranscriptService');

/**
 * Ticket Cleanup Service
 * Handles automatic cleanup of inactive tickets
 * UPDATED: Uses metadata column for fields not in schema
 */
class TicketCleanupService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.cleanupInterval = null;

        // Configuration
        this.config = {
            WARNING_HOURS: 48,
            AUTO_CLOSE_HOURS: 72,
            RATING_TIMEOUT_HOURS: 1,
            DELETE_CLOSED_DAYS: 7,
            CHECK_INTERVAL_MINUTES: 30,

            WHITELIST_TYPES: {
                ticket_ck: 168,
                ticket_blacklist: 336,
                ticket_vip: -1
            },

            LOG_TRANSCRIPTS: '1414065296704016465'
        };
    }

    startScheduler() {
        logger.info('[TICKET-CLEANUP] Starting scheduler...');
        this.runCleanup().catch(err => logger.error('[TICKET-CLEANUP] Initial run error:', err));
        this.cleanupInterval = setInterval(() => {
            this.runCleanup().catch(err => logger.error('[TICKET-CLEANUP] Scheduled run error:', err));
        }, this.config.CHECK_INTERVAL_MINUTES * 60 * 1000);
        logger.info(`[TICKET-CLEANUP] Scheduler started (every ${this.config.CHECK_INTERVAL_MINUTES} minutes)`);
    }

    stopScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('[TICKET-CLEANUP] Scheduler stopped');
        }
    }

    async runCleanup() {
        try {
            logger.debug('[TICKET-CLEANUP] Running cleanup cycle...');
            await this.checkInactiveTickets();
            await this.checkRatingTimeouts();
            await this.autoCloseOldTickets();
            await this.purgeClosedChannels();
            logger.debug('[TICKET-CLEANUP] Cleanup cycle complete');
        } catch (error) {
            logger.errorWithContext('[TICKET-CLEANUP] Cleanup cycle error', error);
        }
    }

    // --- HELPER: Get Metadata Safe ---
    getMeta(ticket) {
        return ticket.metadata || {};
    }

    async updateMeta(ticketId, updates) {
        // Fetch current to merge
        const { data: ticket } = await this.supabase.from('tickets').select('metadata').eq('id', ticketId).single();
        const current = ticket?.metadata || {};
        const newMeta = { ...current, ...updates };
        await this.supabase.from('tickets').update({ metadata: newMeta }).eq('id', ticketId);
    }

    async checkInactiveTickets() {
        const now = new Date();
        const warningThreshold = new Date(now.getTime() - (this.config.WARNING_HOURS * 60 * 60 * 1000));

        // Get OPEN tickets. We filter in memory for JSONB fields to avoid syntax errors.
        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'OPEN');

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching inactive tickets:', error);
            return;
        }

        for (const ticket of tickets || []) {
            const meta = this.getMeta(ticket);
            // Use last_active_at from metadata, fallback to created_at
            const lastActive = meta.last_active_at ? new Date(meta.last_active_at) : new Date(ticket.created_at);

            if (meta.warning_sent) continue; // Already warned
            if (lastActive >= warningThreshold) continue; // Not inactive enough

            try {
                const channel = await this.client.channels.fetch(ticket.channel_id).catch(() => null);
                if (!channel) continue;

                const hoursInactive = Math.floor((now - lastActive) / (60 * 60 * 1000));
                const hoursUntilClose = this.config.AUTO_CLOSE_HOURS - hoursInactive;

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Ticket Inactivo')
                        .setDescription(`Este ticket ha estado inactivo por **${hoursInactive} horas**.\n\nSe cerrará automáticamente en **${hoursUntilClose} horas** si no hay actividad.\n\nSi ya resolviste tu problema, puedes cerrarlo ahora.`)
                        .setColor(0xFEE75C)
                        .setFooter({ text: 'Sistema de Auto-Limpieza' })
                    ]
                });

                await this.updateMeta(ticket.id, { warning_sent: true });
                logger.info(`[TICKET-CLEANUP] Warning sent to ticket #${ticket.id}`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error processing ticket #${ticket.id}:`, err.message);
            }
        }
    }

    async checkRatingTimeouts() {
        const now = new Date();
        const ratingTimeout = new Date(now.getTime() - (this.config.RATING_TIMEOUT_HOURS * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'AWAITING_RATING');

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching rating timeouts:', error);
            return;
        }

        for (const ticket of tickets || []) {
            const meta = this.getMeta(ticket);
            if (!meta.rating_requested_at) continue; // Should have been set on close request

            if (new Date(meta.rating_requested_at) >= ratingTimeout) continue; // Not yet timed out

            try {
                const channel = await this.client.channels.fetch(ticket.channel_id).catch(() => null);
                if (channel) {
                    const ticketData = { ...ticket, closure_reason: 'Timeout Valoración (1h)' };
                    const attachment = await TranscriptService.generate(channel, ticketData);

                    const logChannel = this.client.channels.cache.get(this.config.LOG_TRANSCRIPTS);
                    if (logChannel) {
                        await logChannel.send({
                            embeds: [new EmbedBuilder().setTitle('🕒 Ticket Cerrado por Timeout').setDescription(`Ticket: ${channel.name}`).setColor(0x95A5A6)],
                            files: [attachment]
                        });
                    }

                    if (ticket.user_id) { // Was creator_id
                        try {
                            const creator = await this.client.users.fetch(ticket.user_id);
                            await creator.send({ content: '🕒 Tu ticket se cerró automáticamente por falta de valoración.', files: [attachment] });
                        } catch (e) { }
                    }
                    await channel.delete('Rating timeout (1 hour)');
                }

                await this.updateMeta(ticket.id, { closure_reason: 'rating_timeout' });
                await this.supabase.from('tickets').update({ status: 'CLOSED', closed_at: now.toISOString() }).eq('id', ticket.id);

                logger.info(`[TICKET-CLEANUP] Ticket #${ticket.id} closed due to rating timeout`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error processing rating timeout #${ticket.id}:`, err.message);
            }
        }
    }

    async autoCloseOldTickets() {
        const now = new Date();
        const closeThreshold = new Date(now.getTime() - (this.config.AUTO_CLOSE_HOURS * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'OPEN');

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching old tickets:', error);
            return;
        }

        for (const ticket of tickets || []) {
            const meta = this.getMeta(ticket);
            const lastActive = meta.last_active_at ? new Date(meta.last_active_at) : new Date(ticket.created_at);

            if (lastActive >= closeThreshold) continue;

            try {
                const ticketType = ticket.ticket_type || 'general'; // Was type
                const whitelistHours = this.config.WHITELIST_TYPES[ticketType];

                if (whitelistHours === -1) continue;
                if (whitelistHours) {
                    const customThreshold = new Date(now.getTime() - (whitelistHours * 60 * 60 * 1000));
                    if (lastActive > customThreshold) continue;
                }

                const channel = await this.client.channels.fetch(ticket.channel_id).catch(() => null);
                if (channel) {
                    const ticketData = { ...ticket, closure_reason: 'Inactividad Automática' };
                    const attachment = await TranscriptService.generate(channel, ticketData);

                    if (ticket.user_id) {
                        try {
                            const creator = await this.client.users.fetch(ticket.user_id);
                            await creator.send({ content: '🔒 Tu ticket fue cerrado por inactividad.', files: [attachment] });
                        } catch (e) { }
                    }
                    await channel.delete('Auto-closed (inactivity)');
                } else {
                    await this.updateMeta(ticket.id, { channel_deleted: true, closure_reason: 'channel_not_found' });
                }

                await this.updateMeta(ticket.id, { closure_reason: 'auto_inactive' });
                await this.supabase.from('tickets').update({ status: 'CLOSED', closed_at: now.toISOString() }).eq('id', ticket.id);

                logger.info(`[TICKET-CLEANUP] Ticket #${ticket.id} auto-closed (inactive)`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error auto-closing #${ticket.id}:`, err.message);
            }
        }
    }

    async purgeClosedChannels(daysOld = null) {
        const days = daysOld || this.config.DELETE_CLOSED_DAYS;
        const now = new Date();
        const purgeThreshold = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'CLOSED')
            .lt('closed_at', purgeThreshold.toISOString()); // Standard column

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching closed tickets:', error);
            return;
        }

        let deleted = 0;
        for (const ticket of tickets || []) {
            const meta = this.getMeta(ticket);
            if (meta.channel_deleted) continue;

            try {
                const channel = await this.client.channels.fetch(ticket.channel_id).catch(() => null);
                if (channel) {
                    await channel.delete('Purge old closed ticket');
                    deleted++;
                }
                await this.updateMeta(ticket.id, { channel_deleted: true });
                logger.info(`[TICKET-CLEANUP] Purged ticket channel #${ticket.id}`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error purging #${ticket.id}:`, err.message);
            }
        }
        return deleted;
    }

    async getStats() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const stats = {};

        // Use standard columns where possible
        const { count: openCount } = await this.supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'OPEN');
        stats.open = openCount || 0;

        const { count: closedToday } = await this.supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'CLOSED').gte('closed_at', oneDayAgo.toISOString());
        stats.closedToday = closedToday || 0;

        const { count: closedWeek } = await this.supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'CLOSED').gte('closed_at', oneWeekAgo.toISOString());
        stats.closedWeek = closedWeek || 0;

        const { count: closedMonth } = await this.supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'CLOSED').gte('closed_at', oneMonthAgo.toISOString());
        stats.closedMonth = closedMonth || 0;

        // Fetch all tickets with metadata for rating/ai check (slow but standard way impossible without columns)
        // Optimization: Fetch only non-null metadata?
        const { data: allTickets } = await this.supabase.from('tickets').select('metadata');

        let sumRating = 0;
        let countRating = 0;
        let aiClosed = 0;

        if (allTickets) {
            allTickets.forEach(t => {
                const m = t.metadata || {};
                if (m.rating) {
                    sumRating += m.rating;
                    countRating++;
                }
                if (m.closed_by_ai) {
                    aiClosed++;
                }
            });
        }

        stats.avgRating = countRating > 0 ? (sumRating / countRating).toFixed(2) : 'N/A';
        stats.aiResolved = aiClosed;

        return stats;
    }
}

module.exports = TicketCleanupService;
