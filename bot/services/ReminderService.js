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
            staffAfkThresholdHours: parseInt(process.env.STAFF_AFK_THRESHOLD_HOURS) || 2,
            suspiciousTransactionAmount: parseInt(process.env.SUSPICIOUS_TRANSACTION_AMOUNT) || 100000,
            alertChannelId: process.env.ALERT_CHANNEL_ID || '1450610756663115879',
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
     * Send session vote threshold alert
     */
    async sendSessionVoteAlert(session, voteCount) {
        try {
            const channel = await this.client.channels.fetch(this.config.alertChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('🗳️ ALERTA: Votación Alcanzó Umbral')
                .setColor('#FFA500')
                .setDescription(`Una votación ha alcanzado **${voteCount} votos** y requiere atención de la Junta Directiva.`)
                .addFields(
                    { name: '📊 Votos Totales', value: `${voteCount}`, inline: true },
                    { name: '✅ A Favor', value: `${session.vote_yes || 0}`, inline: true },
                    { name: '❌ En Contra', value: `${session.vote_no || 0}`, inline: true },
                    { name: '📝 Propuesta', value: session.role_name || 'N/A', inline: false }
                )
                .setFooter({ text: 'Considera abrir o cerrar la sesión según los resultados' })
                .setTimestamp();

            await channel.send({
                content: `<@&${this.config.juntaDirectivaRoleId}> Se requiere revisión`,
                embeds: [embed]
            });

            console.log(`[ReminderService] Sent session vote alert for session ID ${session.id}`);
        } catch (error) {
            console.error('[ReminderService] Error sending session vote alert:', error);
        }
    }

    /**
     * Start staff AFK reminder
     */
    startStaffAfkReminder() {
        const checkInterval = setInterval(async () => {
            await this.checkStaffAfk();
        }, 15 * 60 * 1000); // Every 15 minutes

        this.checkIntervals.set('staff_afk', checkInterval);
        console.log('[ReminderService] Staff AFK reminder active');
    }

    /**
     * Check for staff members who have been on duty too long
     */
    async checkStaffAfk() {
        try {
            const thresholdTime = new Date();
            thresholdTime.setHours(thresholdTime.getHours() - this.config.staffAfkThresholdHours);

            const { data: activeShifts, error } = await this.supabase
                .from('staff_shifts')
                .select('*')
                .is('end_time', null) // Still active
                .lt('start_time', thresholdTime.toISOString())
                .order('start_time', { ascending: true });

            if (error || !activeShifts || activeShifts.length === 0) return;

            for (const shift of activeShifts) {
                // Check if we already sent an alert recently (last hour)
                const lastAlert = shift.last_afk_alert ? new Date(shift.last_afk_alert) : null;
                const oneHourAgo = new Date();
                oneHourAgo.setHours(oneHourAgo.getHours() - 1);

                if (!lastAlert || lastAlert < oneHourAgo) {
                    await this.sendStaffAfkAlert(shift);

                    // Update last alert time
                    await this.supabase
                        .from('staff_shifts')
                        .update({ last_afk_alert: new Date().toISOString() })
                        .eq('id', shift.id);
                }
            }
        } catch (error) {
            console.error('[ReminderService] Error checking staff AFK:', error);
        }
    }

    /**
     * Send staff AFK alert
     */
    async sendStaffAfkAlert(shift) {
        try {
            const channel = await this.client.channels.fetch(this.config.alertChannelId);
            if (!channel) return;

            const startTime = new Date(shift.start_time);
            const hoursOnDuty = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60 * 60));

            const embed = new EmbedBuilder()
                .setTitle('⏰ ALERTA: Staff en Turno Prolongado')
                .setColor('#FF6B6B')
                .setDescription(`Un miembro del staff lleva **${hoursOnDuty} horas** en turno sin reportar salida.`)
                .addFields(
                    { name: '👤 Usuario', value: `<@${shift.user_id}>`, inline: true },
                    { name: '⏱️ Tiempo en Turno', value: `${hoursOnDuty} horas`, inline: true },
                    { name: '📅 Inicio de Turno', value: startTime.toLocaleString('es-MX'), inline: false }
                )
                .setFooter({ text: 'Verifica si el usuario está AFK o necesita ayuda' })
                .setTimestamp();

            await channel.send({
                content: `<@&${this.config.juntaDirectivaRoleId}> Revisar turno prolongado`,
                embeds: [embed]
            });

            console.log(`[ReminderService] Sent staff AFK alert for user ${shift.user_id}`);
        } catch (error) {
            console.error('[ReminderService] Error sending staff AFK alert:', error);
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
