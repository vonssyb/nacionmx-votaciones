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

        const messages = await channel.messages.fetch({ limit });
        const deleted = await channel.bulkDelete(messages, true);

        logger.info(`Cleared ${deleted.size} messages from channel ${channelId}`);
        return deleted.size;
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
