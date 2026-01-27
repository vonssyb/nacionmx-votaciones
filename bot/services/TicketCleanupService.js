const logger = require('./Logger');
const { EmbedBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');

/**
 * Ticket Cleanup Service
 * Handles automatic cleanup of inactive tickets
 */
class TicketCleanupService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.cleanupInterval = null;

        // Configuration
        this.config = {
            WARNING_HOURS: 48,           // Warning after 48h inactive
            AUTO_CLOSE_HOURS: 72,        // Auto-close after 72h
            RATING_TIMEOUT_HOURS: 1,     // Close if no rating in 1h
            DELETE_CLOSED_DAYS: 7,       // Delete closed channels after 7 days
            CHECK_INTERVAL_MINUTES: 30,  // Check every 30 min

            // Whitelist (hours before auto-close)
            WHITELIST_TYPES: {
                ticket_ck: 168,          // 7 days
                ticket_blacklist: 336,   // 14 days
                ticket_vip: -1           // Never auto-close
            },

            LOG_TRANSCRIPTS: '1414065296704016465'
        };
    }

    /**
     * Start the cleanup scheduler
     */
    startScheduler() {
        logger.info('[TICKET-CLEANUP] Starting scheduler...');

        // Run immediately on start
        this.runCleanup().catch(err => logger.error('[TICKET-CLEANUP] Initial run error:', err));

        // Then run every CHECK_INTERVAL_MINUTES
        this.cleanupInterval = setInterval(() => {
            this.runCleanup().catch(err => logger.error('[TICKET-CLEANUP] Scheduled run error:', err));
        }, this.config.CHECK_INTERVAL_MINUTES * 60 * 1000);

        logger.info(`[TICKET-CLEANUP] Scheduler started (every ${this.config.CHECK_INTERVAL_MINUTES} minutes)`);
    }

    /**
     * Stop the scheduler
     */
    stopScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('[TICKET-CLEANUP] Scheduler stopped');
        }
    }

    /**
     * Main cleanup routine
     */
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

    /**
     * Check for inactive tickets and send warnings
     */
    async checkInactiveTickets() {
        const now = new Date();
        const warningThreshold = new Date(now.getTime() - (this.config.WARNING_HOURS * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'OPEN')
            .lt('last_active_at', warningThreshold.toISOString())
            .is('warning_sent', false);

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching inactive tickets:', error);
            return;
        }

        for (const ticket of tickets || []) {
            try {
                const channel = await this.client.channels.fetch(ticket.channel_id);
                if (!channel) continue;

                const hoursInactive = Math.floor((now - new Date(ticket.last_active_at)) / (60 * 60 * 1000));
                const hoursUntilClose = this.config.AUTO_CLOSE_HOURS - hoursInactive;

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Ticket Inactivo')
                        .setDescription(`Este ticket ha estado inactivo por **${hoursInactive} horas**.\n\nSe cerrará automáticamente en **${hoursUntilClose} horas** si no hay actividad.\n\nSi ya resolviste tu problema, puedes cerrarlo ahora.`)
                        .setColor(0xFEE75C)
                        .setFooter({ text: 'Sistema de Auto-Limpieza' })
                    ]
                });

                await this.supabase
                    .from('tickets')
                    .update({ warning_sent: true })
                    .eq('id', ticket.id);

                logger.info(`[TICKET-CLEANUP] Warning sent to ticket #${ticket.id}`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error sending warning to ticket #${ticket.id}:`, err.message);
            }
        }
    }

    /**
     * Check for rating timeouts (1 hour to rate, then auto-close)
     */
    async checkRatingTimeouts() {
        const now = new Date();
        const ratingTimeout = new Date(now.getTime() - (this.config.RATING_TIMEOUT_HOURS * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'AWAITING_RATING')
            .lt('rating_requested_at', ratingTimeout.toISOString());

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching rating timeouts:', error);
            return;
        }

        for (const ticket of tickets || []) {
            try {
                const channel = await this.client.channels.fetch(ticket.channel_id);
                if (!channel) continue;

                // Generate transcript
                const attachment = await discordTranscripts.createTranscript(channel, {
                    limit: -1,
                    returnType: 'attachment',
                    filename: `timeout-${channel.name}.html`,
                    saveImages: true
                });

                // Log to transcripts channel
                const logChannel = this.client.channels.cache.get(this.config.LOG_TRANSCRIPTS);
                if (logChannel) {
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🕒 Ticket Cerrado por Timeout')
                            .addFields(
                                { name: 'Ticket', value: channel.name, inline: true },
                                { name: 'Razón', value: 'Sin valoración (1h)', inline: true }
                            )
                            .setColor(0x95A5A6)
                        ],
                        files: [attachment]
                    });
                }

                // Send DM to creator
                if (ticket.creator_id) {
                    try {
                        const creator = await this.client.users.fetch(ticket.creator_id);
                        await creator.send({
                            content: '🕒 Tu ticket se cerró automáticamente porque no fue valorado en 1 hora.',
                            files: [attachment]
                        });
                    } catch (e) { }
                }

                // Update DB
                await this.supabase
                    .from('tickets')
                    .update({
                        status: 'CLOSED',
                        closed_at: now.toISOString(),
                        closure_reason: 'rating_timeout'
                    })
                    .eq('id', ticket.id);

                // Delete channel
                await channel.delete('Rating timeout (1 hour)');

                logger.info(`[TICKET-CLEANUP] Ticket #${ticket.id} closed due to rating timeout`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error processing rating timeout for ticket #${ticket.id}:`, err.message);
            }
        }
    }

    /**
     * Auto-close tickets that are too old
     */
    async autoCloseOldTickets() {
        const now = new Date();
        const closeThreshold = new Date(now.getTime() - (this.config.AUTO_CLOSE_HOURS * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'OPEN')
            .lt('last_active_at', closeThreshold.toISOString());

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching old tickets:', error);
            return;
        }

        for (const ticket of tickets || []) {
            try {
                // Check whitelist
                const ticketType = ticket.type || 'general';
                const whitelistHours = this.config.WHITELIST_TYPES[ticketType];

                if (whitelistHours === -1) {
                    logger.debug(`[TICKET-CLEANUP] Ticket #${ticket.id} (${ticketType}) is whitelisted (never auto-close)`);
                    continue;
                }

                if (whitelistHours) {
                    const customThreshold = new Date(now.getTime() - (whitelistHours * 60 * 60 * 1000));
                    if (new Date(ticket.last_active_at) > customThreshold) {
                        logger.debug(`[TICKET-CLEANUP] Ticket #${ticket.id} not old enough for ${ticketType} (needs ${whitelistHours}h)`);
                        continue;
                    }
                }

                const channel = await this.client.channels.fetch(ticket.channel_id);
                if (!channel) continue;

                // Generate transcript
                const attachment = await discordTranscripts.createTranscript(channel, {
                    limit: -1,
                    returnType: 'attachment',
                    filename: `auto-close-${channel.name}.html`,
                    saveImages: true
                });

                // Log
                const logChannel = this.client.channels.cache.get(this.config.LOG_TRANSCRIPTS);
                if (logChannel) {
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔒 Ticket Auto-Cerrado')
                            .addFields(
                                { name: 'Ticket', value: channel.name, inline: true },
                                { name: 'Razón', value: 'Inactividad (>72h)', inline: true }
                            )
                            .setColor(0xE74C3C)
                        ],
                        files: [attachment]
                    });
                }

                // Send DM
                if (ticket.creator_id) {
                    try {
                        const creator = await this.client.users.fetch(ticket.creator_id);
                        await creator.send({
                            content: '🔒 Tu ticket fue cerrado por inactividad. Puedes abrir uno nuevo si aún necesitas ayuda.',
                            files: [attachment]
                        });
                    } catch (e) { }
                }

                // Update DB
                await this.supabase
                    .from('tickets')
                    .update({
                        status: 'CLOSED',
                        closed_at: now.toISOString(),
                        closure_reason: 'auto_inactive'
                    })
                    .eq('id', ticket.id);

                // Delete channel
                await channel.delete('Auto-closed (inactivity)');

                logger.info(`[TICKET-CLEANUP] Ticket #${ticket.id} auto-closed (inactive)`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error auto-closing ticket #${ticket.id}:`, err.message);
            }
        }
    }

    /**
     * Purge channels of old closed tickets
     */
    async purgeClosedChannels(daysOld = null) {
        const days = daysOld || this.config.DELETE_CLOSED_DAYS;
        const now = new Date();
        const purgeThreshold = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        const { data: tickets, error } = await this.supabase
            .from('tickets')
            .select('*')
            .eq('status', 'CLOSED')
            .lt('closed_at', purgeThreshold.toISOString())
            .is('channel_deleted', false);

        if (error) {
            logger.error('[TICKET-CLEANUP] Error fetching closed tickets:', error);
            return;
        }

        let deleted = 0;

        for (const ticket of tickets || []) {
            try {
                const channel = await this.client.channels.fetch(ticket.channel_id).catch(() => null);

                if (channel) {
                    await channel.delete('Purge old closed ticket');
                    deleted++;
                }

                // Mark as deleted in DB
                await this.supabase
                    .from('tickets')
                    .update({ channel_deleted: true })
                    .eq('id', ticket.id);

                logger.info(`[TICKET-CLEANUP] Purged ticket channel #${ticket.id}`);
            } catch (err) {
                logger.warn(`[TICKET-CLEANUP] Error purging ticket #${ticket.id}:`, err.message);
            }
        }

        if (deleted > 0) {
            logger.info(`[TICKET-CLEANUP] Purged ${deleted} old ticket channels`);
        }

        return deleted;
    }

    /**
     * Get ticket statistics
     */
    async getStats() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        const stats = {};

        // Total open
        const { count: openCount } = await this.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'OPEN');
        stats.open = openCount || 0;

        // Closed today
        const { count: closedToday } = await this.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'CLOSED')
            .gte('closed_at', oneDayAgo.toISOString());
        stats.closedToday = closedToday || 0;

        // Closed this week
        const { count: closedWeek } = await this.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'CLOSED')
            .gte('closed_at', oneWeekAgo.toISOString());
        stats.closedWeek = closedWeek || 0;

        // Closed this month
        const { count: closedMonth } = await this.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'CLOSED')
            .gte('closed_at', oneMonthAgo.toISOString());
        stats.closedMonth = closedMonth || 0;

        // Average rating
        const { data: ratedTickets } = await this.supabase
            .from('tickets')
            .select('rating')
            .not('rating', 'is', null);

        if (ratedTickets && ratedTickets.length > 0) {
            const sum = ratedTickets.reduce((acc, t) => acc + (t.rating || 0), 0);
            stats.avgRating = (sum / ratedTickets.length).toFixed(2);
        } else {
            stats.avgRating = 'N/A';
        }

        // AI resolution rate
        const { count: aiClosed } = await this.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('closed_by_ai', true);
        stats.aiResolved = aiClosed || 0;

        return stats;
    }
}

module.exports = TicketCleanupService;
