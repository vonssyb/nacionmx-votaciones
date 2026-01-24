const { EmbedBuilder, AuditLogEvent, AttachmentBuilder } = require('discord.js');
const logger = require('../../services/Logger');
const { CHANNELS, GUILDS } = require('../../config/constants');

module.exports = async (client, message, supabase) => {
    if (!message.guild || message.author?.bot) return;

    // Config: Main Guilds Only
    const MAIN_GUILDS = [GUILDS.MAIN, GUILDS.STAFF];
    if (!MAIN_GUILDS.includes(message.guild.id)) return;

    try {
        const logChannelId = CHANNELS.LOGS_GENERAL;
        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!logChannel) return;

        // --- 🔍 ADVANCED DEBUG SYSTEM ---
        let executedBy = 'Desconocido/Usuario'; // Default assumes user self-delete if no log found
        let debugInfo = ''; // Extra debug data

        // 1. CAPTURE MESSAGE FLAGS (Discord System Actions)
        const messageFlags = [];
        if (message.flags) {
            const flagBits = message.flags.bitfield;
            const flagNames = {
                1: 'CROSSPOSTED',
                2: 'IS_CROSSPOST',
                4: 'SUPPRESS_EMBEDS',
                8: 'SOURCE_MESSAGE_DELETED',
                16: 'URGENT',
                32: 'HAS_THREAD',
                64: 'EPHEMERAL',
                128: 'LOADING',
                256: 'FAILED_TO_MENTION_SOME_ROLES_IN_THREAD',
                4096: 'SUPPRESS_NOTIFICATIONS',
                8192: 'IS_VOICE_MESSAGE'
            };

            for (const [bit, name] of Object.entries(flagNames)) {
                if (flagBits & parseInt(bit)) messageFlags.push(name);
            }
        }

        // 2. CAPTURE FILE DETAILS
        let attachmentInfo = '';
        if (message.attachments.size > 0) {
            const att = message.attachments.first();
            attachmentInfo = `\n📎 **Archivo:** ${att.name}\n📏 **Tamaño:** ${(att.size / 1024).toFixed(2)} KB\n🎬 **Tipo:** ${att.contentType || 'Desconocido'}`;
        }

        // 3. FETCH DETAILED AUDIT LOG
        let auditDetails = '';
        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: 5, // Get last 5 to see patterns
                type: AuditLogEvent.MessageDelete,
            });

            const deletionLog = fetchedLogs.entries.first();

            if (deletionLog) {
                const { executor, target, createdTimestamp, extra } = deletionLog;
                const timeDiff = Date.now() - createdTimestamp;

                // Match by author AND recent timing (within 5s)
                if (target.id === message.author.id && timeDiff < 5000) {
                    executedBy = `${executor.tag} (${executor.id})`;
                    if (executor.bot) executedBy += ' 🤖 [BOT]';

                    auditDetails = `\n🕒 **Audit Log Time:** ${timeDiff}ms ago\n📊 **Extra Data:** ${JSON.stringify(extra || {})}`;
                } else {
                    auditDetails = `\n⚠️ **Audit Log:** No match (Target: ${target?.tag || 'N/A'}, Time: ${timeDiff}ms)`;
                    executedBy = 'Usuario (Autoborrado)'; // Stronger inference: No log = User did it
                    debugInfo += '\n💡 **NOTA TÉCNICA:** Si no hay registro de auditoría, Discord confirma que **fue el propio usuario** quien borró el mensaje (o una aplicación logueada en su cuenta). Los bots SIEMPRE dejan rastro.';
                }
            }
        } catch (auditErr) {
            auditDetails = `\n❌ **Audit Error:** ${auditErr.message}`;
        }

        // 4. CHECK IF WEBHOOK MESSAGE
        let webhookInfo = '';
        if (message.webhookId) {
            webhookInfo = `\n🪝 **Webhook ID:** ${message.webhookId}`;
        }

        // 5. SYSTEM MESSAGE CHECK
        let systemInfo = '';
        if (message.system) {
            systemInfo = `\n🤖 **System Message:** ${message.type}`;
        }

        // 6. COMPILE DEBUG STRING
        debugInfo = `\n\n🔍 **DEBUG INFO:**\n🚩 **Flags:** ${messageFlags.length > 0 ? messageFlags.join(', ') : 'None'}${attachmentInfo}${auditDetails}${webhookInfo}${systemInfo}`;

        // --- RE-UPLOAD ATTACHMENTS ---
        const files = [];

        if (message.attachments.size > 0) {
            message.attachments.forEach(att => {
                files.push(new AttachmentBuilder(att.proxyURL || att.url, { name: att.name }));
            });
        }

        // --- DISCORD EMBED ---
        const embed = new EmbedBuilder()
            .setTitle(`🗑️ Mensaje Eliminado - DEBUG MODE`)
            .setColor('#FF0000')
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .addFields(
                { name: 'Autor', value: `<@${message.author.id}>`, inline: true },
                { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Eliminado Por', value: `**${executedBy}**`, inline: false },
                { name: 'Contenido', value: message.content ? message.content.substring(0, 1024) : '*(Sin contenido de texto)*' }
            )
            .setDescription(debugInfo.substring(0, 4000)) // Discord limit
            .setFooter({ text: `ID: ${message.id} | Bot Debug System Activo` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed], files: files });

    } catch (err) {
        logger.errorWithContext('Error logging message deletion', err, { module: 'MOD' });
    }
};
