/**
 * LogHelper
 * Centralized logging utility for consistent log formatting and channel management
 * 
 * Usage:
 *   const LogHelper = require('../utils/LogHelper');
 *   await LogHelper.logTransaction(client, guildId, {...});
 */

const { EmbedBuilder } = require('discord.js');
const PermissionService = require('../services/PermissionService');

class LogHelper {
    /**
     * Log a transaction to the appropriate channel
     * @param {Client} client - Discord client
     * @param {string} guildId - Guild ID
     * @param {object} data - Transaction data
     * @param {string} data.type - Transaction type (transfer, payment, purchase, etc.)
     * @param {string} data.userId - User ID
     * @param {number} data.amount - Amount
     * @param {string} data.description - Description
     * @param {string} data.method - Payment method (optional)
     * @param {string} channelKey - Channel key from roles.json (optional)
     */
    static async logTransaction(client, guildId, data, channelKey = 'tienda_logs') {
        const channelId = PermissionService.getChannelId(channelKey);
        if (!channelId) {
            console.warn(`[LogHelper] Channel not found: ${channelKey}`);
            return;
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle(`💰 Transacción: ${data.type}`)
                .setColor('#00FF00')
                .addFields(
                    { name: 'Usuario', value: `<@${data.userId}>`, inline: true },
                    { name: 'Monto', value: `$${data.amount.toLocaleString()}`, inline: true },
                    { name: 'Descripción', value: data.description, inline: false }
                )
                .setTimestamp();

            if (data.method) {
                embed.addFields({ name: 'Método', value: data.method, inline: true });
            }

            if (data.extra) {
                Object.entries(data.extra).forEach(([key, value]) => {
                    embed.addFields({ name: key, value: String(value), inline: true });
                });
            }

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[LogHelper] Error logging transaction:', error);
        }
    }

    /**
     * Log a moderation action
     * @param {Client} client - Discord client
     * @param {object} data - Action data
     * @param {string} data.type - Action type (arrest, fine, ck, sanction, etc.)
     * @param {string} data.moderator - Moderator user ID
     * @param {string} data.target - Target user ID
     * @param {string} data.reason - Reason
     * @param {number} data.amount - Amount (fines, etc.) - optional
     * @param {string} channelKey - Channel key from roles.json
     */
    static async logAction(client, data, channelKey) {
        const channelId = PermissionService.getChannelId(channelKey);
        if (!channelId) {
            console.warn(`[LogHelper] Channel not found: ${channelKey}`);
            return;
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) return;

            const colorMap = {
                arrest: '#FF0000',
                fine: '#FFA500',
                ck: '#000000',
                sanction: '#FF6347',
                warn: '#FFD700',
                ban: '#8B0000',
                kick: '#DC143C'
            };

            const iconMap = {
                arrest: '🚔',
                fine: '💸',
                ck: '☠️',
                sanction: '⚠️',
                warn: '⚠️',
                ban: '🔨',
                kick: '👢'
            };

            const embed = new EmbedBuilder()
                .setTitle(`${iconMap[data.type] || '📋'} Acción: ${data.type.toUpperCase()}`)
                .setColor(colorMap[data.type] || '#808080')
                .addFields(
                    { name: 'Moderador', value: `<@${data.moderator}>`, inline: true },
                    { name: 'Usuario', value: `<@${data.target}>`, inline: true },
                    { name: 'Razón', value: data.reason || 'No especificada', inline: false }
                )
                .setTimestamp();

            if (data.amount) {
                embed.addFields({ name: 'Monto', value: `$${data.amount.toLocaleString()}`, inline: true });
            }

            if (data.duration) {
                embed.addFields({ name: 'Duración', value: data.duration, inline: true });
            }

            if (data.extra) {
                Object.entries(data.extra).forEach(([key, value]) => {
                    embed.addFields({ name: key, value: String(value), inline: true });
                });
            }

            // Add footer with IDs for tracking
            embed.setFooter({ text: `Mod: ${data.moderator} | Target: ${data.target}` });

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[LogHelper] Error logging action:', error);
        }
    }

    /**
     * Log an error to error channel
     * @param {Client} client - Discord client
     * @param {Error} error - Error object
     * @param {object} context - Error context
     * @param {string} context.command - Command name
     * @param {string} context.userId - User ID
     * @param {string} context.guildId - Guild ID
     */
    static async logError(client, error, context = {}) {
        const channelId = PermissionService.getChannelId('error_logs');
        if (!channelId) return;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('🚨 Error en Comando')
                .setColor('#FF0000')
                .setDescription(`\`\`\`js\n${error.message}\n\`\`\``)
                .setTimestamp();

            if (context.command) {
                embed.addFields({ name: 'Comando', value: `\`/${context.command}\``, inline: true });
            }

            if (context.userId) {
                embed.addFields({ name: 'Usuario', value: `<@${context.userId}>`, inline: true });
            }

            if (error.stack) {
                const stack = error.stack.slice(0, 1000);
                embed.addFields({ name: 'Stack Trace', value: `\`\`\`js\n${stack}\n\`\`\`` });
            }

            if (context.extra) {
                const extraStr = JSON.stringify(context.extra, null, 2).slice(0, 500);
                embed.addFields({ name: 'Context', value: `\`\`\`json\n${extraStr}\n\`\`\`` });
            }

            await channel.send({ embeds: [embed] });
        } catch (logError) {
            console.error('[LogHelper] Failed to log error to channel:', logError);
        }
    }

    /**
     * Log a government action (DNI creation, license grant, etc.)
     * @param {Client} client - Discord client
     * @param {object} data - Government action data
     * @param {string} data.type - Action type
     * @param {string} data.officer - Officer user ID
     * @param {string} data.citizen - Citizen user ID
     * @param {object} data.details - Additional details
     */
    static async logGovernmentAction(client, data) {
        try {
            // For now, we'll create a generic embed
            // Later, you can specify custom channels per action type
            const embed = new EmbedBuilder()
                .setTitle(`🏛️ Acción Gubernamental: ${data.type}`)
                .setColor('#1E90FF')
                .addFields(
                    { name: 'Oficial', value: `<@${data.officer}>`, inline: true },
                    { name: 'Ciudadano', value: `<@${data.citizen}>`, inline: true }
                )
                .setTimestamp();

            if (data.details) {
                Object.entries(data.details).forEach(([key, value]) => {
                    embed.addFields({ name: key, value: String(value), inline: true });
                });
            }

            // Log to a generic government log channel (add to roles.json if needed)
            const channelId = '1457583225085100283'; // Reusing arrest_logs for now
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[LogHelper] Error logging government action:', error);
        }
    }

    /**
     * Create a standard embed with consistent styling
     * @param {string} title - Embed title
     * @param {string} description - Embed description
     * @param {string} color - Hex color (default: blue)
     * @param {array} fields - Fields array [{name, value, inline}]
     * @returns {EmbedBuilder}
     */
    static createEmbed(title, description, color = '#0099FF', fields = []) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        if (fields && fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    }

    /**
     * Create a success embed
     * @param {string} title - Title
     * @param {string} description - Description
     * @param {array} fields - Optional fields
     * @returns {EmbedBuilder}
     */
    static createSuccessEmbed(title, description, fields = []) {
        return this.createEmbed(title, description, '#00FF00', fields);
    }

    /**
     * Create an error embed
     * @param {string} title - Title
     * @param {string} description - Description
     * @param {array} fields - Optional fields
     * @returns {EmbedBuilder}
     */
    static createErrorEmbed(title, description, fields = []) {
        return this.createEmbed(title, description, '#FF0000', fields);
    }

    /**
     * Create a warning embed
     * @param {string} title - Title
     * @param {string} description - Description
     * @param {array} fields - Optional fields
     * @returns {EmbedBuilder}
     */
    static createWarningEmbed(title, description, fields = []) {
        return this.createEmbed(title, description, '#FFA500', fields);
    }

    /**
     * Create an info embed
     * @param {string} title - Title
     * @param {string} description - Description
     * @param {array} fields - Optional fields
     * @returns {EmbedBuilder}
     */
    static createInfoEmbed(title, description, fields = []) {
        return this.createEmbed(title, description, '#0099FF', fields);
    }

    /**
     * Validate channel exists before logging
     * @param {Client} client - Discord client
     * @param {string} channelKey - Channel key from roles.json
     * @returns {Promise<boolean>}
     */
    static async validateChannel(client, channelKey) {
        const channelId = PermissionService.getChannelId(channelKey);
        if (!channelId) return false;

        try {
            const channel = await client.channels.fetch(channelId);
            return channel !== null;
        } catch {
            return false;
        }
    }
}

module.exports = LogHelper;
