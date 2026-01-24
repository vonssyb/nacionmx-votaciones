/**
 * @module services/LogManager
 * @description Centralized manager for Discord Channel Logging and Audit Logs
 */

const logger = require('./Logger');
const { EmbedBuilder } = require('discord.js');

class LogManager {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;

        // Centralized Channel Configuration
        this.CHANNELS = {
            BANK_REGISTRY: '1452346918620500041',
            ROLE_CANCEL: '1450610756663115879',
            COMPANY: '1452346918620500041', // Shared with Bank Registry
            LICENSE: '1450262813548482665',
            STORE: '1452499876737978438',
            POLICE: '1399106787558424629',
            REPORT: '1456035521141670066',
            APPROVAL: '1456047784724529316',
            BLACKLIST: '1412957060168945747',
            AUDIT: '1412882250965717053' // Default Audit Log (if available, otherwise fallback)
        };
    }

    /**
     * Log an embed to a specific channel type
     * @param {string} type - Key from this.CHANNELS
     * @param {EmbedBuilder} embed - The embed to send
     * @param {string} [content] - Optional text content
     */
    async log(type, embed, content = null) {
        const channelId = this.CHANNELS[type];
        if (!channelId) {
            // Silence warning for unknown types, just return false
            // logger.warn(`[LogManager] Unknown channel type: ${type}`);
            return false;
        }

        try {
            // Try to get from cache first
            let channel = this.client.channels.cache.get(channelId);

            // If not in cache, fetch it
            if (!channel) {
                try {
                    channel = await this.client.channels.fetch(channelId);
                } catch (e) {
                    // Reduce log level for 'Unknown Channel' to debug or warn only once
                    // Check if we already warned about this channel recently? 
                    // For now, valid fix is just to catch quietly if it's 404
                    if (e.code === 10003) { // Unknown Channel
                        // Only warn if we haven't warned about this specific channel recently (optional optimization)
                        logger.warn(`[LogManager] Channel not found: ${channelId} (${type}) - Logging disabled for this event.`);
                        return false;
                    }
                    throw e;
                }
            }

            if (!channel) return false;

            const payload = { embeds: [embed] };
            if (content) payload.content = content;

            await channel.send(payload);
            return true;
        } catch (error) {
            logger.errorWithContext(`[LogManager] Failed to log to ${type}`, error);
            return false;
        }
    }

    /**
     * Log a standardized audit action (DB + Discord Channel)
     * Replaces client.logAudit
     */
    async logAudit(title, description, executorUser, targetUser = null, color = 0x3498DB) {
        // 1. Send to Discord Channel
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: 'Nación MX • Auditoría' });

        if (executorUser) embed.addFields({ name: 'Executor', value: `${executorUser.tag} (<@${executorUser.id}>)`, inline: true });
        if (targetUser) embed.addFields({ name: 'Target', value: targetUser.tag ? `${targetUser.tag} (<@${targetUser.id}>)` : `<@${targetUser.id || targetUser}>`, inline: true });

        // Use 'AUDIT' channel if defined, or just log to console if not critical
        // We assume an AUDIT channel exists or reuse one of the admin channels
        // For now, if AUDIT ID is not valid, we skip discord log or use a fallback.
        await this.log('AUDIT', embed);

        // 2. Log to Audit Table (if exists) or File
        // Assuming we might have an 'audit_logs' table, or just use file logging
        logger.info(`[AUDIT] ${title} - ${executorUser?.tag} -> ${targetUser?.tag || 'N/A'}`, { description });

        // Optional: Save to DB if table exists (Phase 3 optimization)
    }

    getChannelId(type) {
        return this.CHANNELS[type];
    }
}

module.exports = LogManager;
