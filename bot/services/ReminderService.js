/**
 * ReminderService - Automated Notification System
 * 
 * Provides real-time alerts for critical events:
 * - Session voting thresholds
 * - Staff AFK detection
 * - Suspicious transactions
 */

const { EmbedBuilder } = require('discord.js');

class ReminderService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.checkIntervals = new Map();

        // Configuration
        this.config = {
            sessionVoteThreshold: parseInt(process.env.SESSION_VOTE_THRESHOLD) || 5,
            suspiciousTransactionAmount: parseInt(process.env.SUSPICIOUS_TRANSACTION_AMOUNT) || 100000,
            sessionVotesChannelId: '1398891368398585886', // Specific channel for session votes
            juntaDirectivaRoleId: '1412882245735420006'
        };
    }

    /**
     * Start all reminder checks
     */
    startAllReminders() {
        console.log('[ReminderService] Starting all reminder checks...');

        // Check session votes every 2 minutes
        this.startSessionVoteReminder();

        // Check staff AFK every 15 minutes
        this.startStaffAfkReminder();

        // Suspicious transactions are handled by AuditService in real-time

        console.log('[ReminderService] All reminders active');
    }

    /**
     * Stop all reminder checks
     */
    stopAllReminders() {
        console.log('[ReminderService] Stopping all reminders...');
        for (const [name, interval] of this.checkIntervals) {
            clearInterval(interval);
            console.log(`[ReminderService] Stopped: ${name}`);
        }
        this.checkIntervals.clear();
    }

    /**
     * Start session vote threshold reminders
     */
    startSessionVoteReminder() {
        const checkInterval = setInterval(async () => {
            await this.checkSessionVotes();
        }, 2 * 60 * 1000); // Every 2 minutes

        this.checkIntervals.set('session_votes', checkInterval);
        console.log('[ReminderService] Session vote reminder active');
    }

    /**
     * Check if any session voting has reached threshold
     */
    async checkSessionVotes() {
        try {
            const { data: activeSessions, error } = await this.supabase
                .from('session_votes')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error || !activeSessions || activeSessions.length === 0) return;

            for (const session of activeSessions) {
                const voteCount = (session.vote_yes || 0) + (session.vote_no || 0);

                if (voteCount >= this.config.sessionVoteThreshold && !session.threshold_alerted) {
                    await this.sendSessionVoteAlert(session, voteCount);

                    // Mark as alerted to prevent spam
                    await this.supabase
                        .from('session_votes')
                        .update({ threshold_alerted: true })
                        .eq('id', session.id);
                }
            }
        } catch (error) {
            console.error('[ReminderService] Error checking session votes:', error);
        }
    }

    /**
     * Send session vote threshold alert with buttons and stats
     */
    async sendSessionVoteAlert(session, voteCount) {
        try {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const channel = await this.client.channels.fetch(this.config.sessionVotesChannelId);
            if (!channel) return;

            // Build embed with stats
            const embed = new EmbedBuilder()
                .setTitle('🗳️ VOTACIÓN DE SESIÓN - DECISIÓN REQUERIDA')
                .setColor('#FFA500')
                .setDescription(`La votación ha alcanzado **${voteCount} votos**. ¿Abrir la sesión?`)
                .addFields(
                    { name: '📊 Votos Totales', value: `${voteCount}`, inline: true },
                    { name: '✅ A Favor', value: `${session.vote_yes || 0}`, inline: true },
                    { name: '❌ En Contra', value: `${session.vote_no || 0}`, inline: true }
                )
                .setTimestamp();

            // Add staff stats if available
            if (session.metadata && session.metadata.staff_stats) {
                const stats = session.metadata.staff_stats;
                let statsText = '';
                if (stats.apuntados) statsText += `📝 Staff Apuntados: ${stats.apuntados}\n`;
                if (stats.inmediato) statsText += `⚡ Entrada Inmediata: ${stats.inmediato}\n`;
                if (stats.retraso) statsText += `⏰ Con Retraso: ${stats.retraso}`;

                if (statsText) {
                    embed.addFields({ name: '👥 Estadísticas del Staff', value: statsText, inline: false });
                }
            }

            // Create buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`session_open_${session.id}`)
                        .setLabel('✅ Abrir Sesión')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`session_noopen_${session.id}`)
                        .setLabel('❌ No Abrir')
                        .setStyle(ButtonStyle.Danger)
                );

            await channel.send({
                content: `<@&${this.config.juntaDirectivaRoleId}> Decisión requerida`,
                embeds: [embed],
                components: [row]
            });

            console.log(`[ReminderService] Sent session vote alert for session ID ${session.id}`);
        } catch (error) {
            console.error('[ReminderService] Error sending session vote alert:', error);
        }
    }


    /**
     * Send manual notification (utility method)
     */
    async sendCustomAlert(title, description, fields = [], color = '#00AAC0') {
        try {
            const channel = await this.client.channels.fetch(this.config.alertChannelId);
            if (!channel) return false;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp();

            if (fields.length > 0) {
                embed.addFields(fields);
            }

            await channel.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error('[ReminderService] Error sending custom alert:', error);
            return false;
        }
    }
}

module.exports = ReminderService;
