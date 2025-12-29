const logger = require('./logger');

/**
 * Utility functions for Discord channel management
 */

/**
 * Rename a Discord channel
 * This is the ONLY renameChannel function - replaces 141 duplicates
 * 
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID to rename
 * @param {string} newName - New channel name
 * @returns {Promise<boolean>} Success status
 */
async function renameChannel(client, channelId, newName) {
    try {
        if (!client || !channelId || !newName) {
            logger.warn('renameChannel: Missing required parameters', { channelId, newName });
            return false;
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            logger.warn(`Channel ${channelId} not found`);
            return false;
        }

        await channel.setName(newName);
        logger.info(`Channel renamed successfully: ${channel.name} -> ${newName}`, {
            channelId,
            oldName: channel.name,
            newName
        });
        return true;
    } catch (error) {
        logger.error('Channel rename error:', {
            channelId,
            newName,
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Clear all messages from a channel
 * 
 * @param {Client} client - Discord client instance
 * @param {string} channelId - Channel ID to clear
 * @param {number} limit - Max messages to delete (default: 100)
 * @returns {Promise<number>} Number of messages deleted
 */
async function clearChannelMessages(client, channelId, limit = 100) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            logger.warn(`Channel ${channelId} not found or not text-based`);
            return 0;
        }

        let totalDeleted = 0;
        let fetched;

        do {
            fetched = await channel.messages.fetch({ limit: Math.min(limit - totalDeleted, 100) });
            if (fetched.size === 0) break;

            // Try bulk delete first (fastest)
            const bulkDeletable = fetched.filter(msg => Date.now() - msg.createdTimestamp < 1209600000); // 14 days
            if (bulkDeletable.size > 0) {
                await channel.bulkDelete(bulkDeletable);
                totalDeleted += bulkDeletable.size;
            }

            // Manually delete old messages (slow but necessary)
            const oldMessages = fetched.filter(msg => Date.now() - msg.createdTimestamp >= 1209600000);
            for (const msg of oldMessages.values()) {
                try {
                    await msg.delete();
                    totalDeleted++;
                } catch (e) {
                    logger.warn(`Failed to delete message ${msg.id}: ${e.message}`);
                }
            }

            // Safety break to prevent infinite loops if deletion fails
            if (fetched.size > 0 && totalDeleted === 0) break;

        } while (totalDeleted < limit && fetched.size >= 1);

        logger.info(`Cleared ${totalDeleted} messages from channel ${channelId}`);
        return totalDeleted;
    } catch (error) {
        logger.error('Error clearing channel messages:', {
            channelId,
            error: error.message
        });
        return 0;
    }
}

module.exports = {
    renameChannel,
    clearChannelMessages
};
