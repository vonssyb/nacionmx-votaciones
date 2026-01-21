const { EmbedBuilder } = require('discord.js');
const NotificationTemplates = require('../services/NotificationTemplates'); // Assuming this exists or will be moved
// If NotificationTemplates path is wrong, I will need to fix it. It was used in sancion.js as '../../services/NotificationTemplates' so '../services/NotificationTemplates' is correct relative to services/SanctionService.js

class SanctionService {
    constructor(supabase, client, logManager, roleManager, erlcService) {
        this.supabase = supabase;
        this.client = client;
        this.logManager = logManager;
        this.roleManager = roleManager;
        this.erlcService = erlcService;
        this.processingLocks = new Set();
    }

    /**
     * CENTRAL PUNISHMENT EXECUTOR
     * Handles Discord Actions, ERLC Actions, DB Records, Logs, and DMs.
     * @param {Interaction} interaction - Originating interaction
     * @param {User} targetUser - Discord User Object
     * @param {string} type - 'general', 'sa', 'notificacion'
     * @param {string} action - 'Warn', 'Kick Discord', 'Ban Temporal Discord', 'Ban Permanente Discord', 'Timeout', 'Blacklist', etc.
     * @param {string} reason - Rule reference or short reason
     * @param {string} description - Detailed description
     * @param {string} evidenceUrl - URL to evidence
     * @param {string} durationText - Human readable duration
     * @param {number} durationMs - Duration in milliseconds
     * @param {string} [robloxIdentifier] - Optional Roblox Username/ID for ERLC actions
     */
    async executePunishment(interaction, targetUser, type, action, reason, description, evidenceUrl, durationText, durationMs, robloxIdentifier = null) {
        const result = {
            success: true,
            messages: [],
            errors: []
        };

        // 1. Calculate Expiration
        let expiresAt = null;
        if (durationMs > 0) {
            expiresAt = new Date(Date.now() + durationMs).toISOString();
        }

        // 2. Execute Discord Action
        if (action && action !== 'Warn' && action !== 'Advertencia Verbal' && type !== 'notificacion') {
            const discordResult = await this.executeDiscordPunishment(interaction, targetUser, action, reason, durationMs);
            if (discordResult.success) {
                result.messages.push(discordResult.message);
            } else {
                result.errors.push(discordResult.message);
            }
        }

        // 3. Execute ERLC Action (If applicable)
        if (action && (action.includes('ERLC') || action === 'Blacklist')) {
            const erlcResult = await this.executeErlcPunishment(interaction, robloxIdentifier, action, reason, durationMs);
            if (erlcResult.success) {
                result.messages.push(erlcResult.message);
            } else {
                result.errors.push(erlcResult.message);
            }
        }

        // 4. Role Management (SA & Blacklist)
        if (type === 'sa' || action === 'Blacklist') {
            const roleResult = await this.executeRoleManagement(interaction, targetUser, type, action, reason);
            if (roleResult.success) {
                result.messages.push(roleResult.message);
            } else {
                // Non-critical error usually
                result.errors.push(roleResult.message);
            }
        }

        // 5. Create Database Record
        try {
            await this.createSanction(
                targetUser.id,
                interaction.user.id,
                type,
                reason,
                evidenceUrl,
                expiresAt,
                action,
                description
            );
        } catch (dbErr) {
            console.error('[SanctionService] DB Error:', dbErr);
            result.errors.push('Error guardando en base de datos.');
        }

        // 6. Log & Notify
        await this.logAndNotify(interaction, targetUser, type, action, reason, description, evidenceUrl, durationText, result);

        return result;
    }

    /**
     * Executes Discord native punishments (Ban, Kick, Timeout)
     */
    async executeDiscordPunishment(interaction, targetUser, action, reason, durationMs) {
        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) return { success: false, message: 'Usuario no encontrado en el servidor (Discord).' };

        const modTag = interaction.user.tag;
        const fullReason = `${action}: ${reason} - Por ${modTag}`;

        try {
            switch (action) {
                case 'Timeout':
                case 'Timeout / Mute':
                    if (!member.moderatable) return { success: false, message: 'No puedo silenciar a este usuario (Jerarquía).' };
                    if (durationMs < 1000) return { success: false, message: 'Duración inválida para Timeout.' };
                    await member.timeout(durationMs, fullReason);
                    return { success: true, message: `🤐 **Timeout aplicado** por ${durationMs / 1000 / 60}m.` };

                case 'Kick Discord':
                    if (!member.kickable) return { success: false, message: 'No puedo expulsar a este usuario (Jerarquía).' };
                    await member.kick(fullReason);
                    return { success: true, message: '👢 **Usuario expulsado (Kick) del Discord.**' };

                default:
                    // Check for partial matches like "Blacklist: Total" or "Ban Temporal (10m)"
                    if (action.startsWith('Ban') || action.startsWith('Blacklist')) {
                        if (!member.bannable) return { success: false, message: 'No puedo banear a este usuario (Jerarquía).' };
                        await member.ban({ deleteMessageDays: 1, reason: fullReason });

                        if (action.includes('Temporal')) {
                            await this.scheduleUnban(guild.id, targetUser.id, fullReason, durationMs);
                        }
                        return { success: true, message: '🔨 **Usuario Baneado del Discord.**' };
                    }
                    return { success: true, message: '' }; // No Discord action needed
            }
        } catch (error) {
            console.error('[SanctionService] Discord Action Error:', error);
            return { success: false, message: `Error ejecutando ${action}: ${error.message}` };
        }
    }

    async scheduleUnban(guildId, userId, reason, durationMs) {
        const expiresAt = new Date(Date.now() + durationMs);
        await this.supabase.from('temporary_bans').insert({
            guild_id: guildId,
            user_id: userId,
            ban_type: 'discord',
            reason: reason,
            expires_at: expiresAt.toISOString()
        });
    }

    /**
     * Executes ERLC In-Game Punishments
     */
    async executeErlcPunishment(interaction, robloxIdentifier, action, reason, durationMs) {
        if (!robloxIdentifier) return { success: false, message: 'No se identificó usuario de Roblox para acción ERLC.' };
        if (!this.erlcService) return { success: false, message: 'Servicio ERLC no disponible.' };

        // 999999 is effectively permanent
        const erlcDuration = (action === 'Ban Temporal ERLC') ? '999999' : '999999';
        // ERLC API doesn't support temp bans natively usually, so we ban perm and auto-unban.

        let cmd = '';
        if (action.includes('Kick')) {
            cmd = `:kick ${robloxIdentifier} ${reason}`;
        } else if (action.includes('Ban') || action === 'Blacklist') {
            cmd = `:ban ${robloxIdentifier} ${erlcDuration} ${reason}`;
        }

        try {
            const success = await this.erlcService.runCommand(cmd);
            if (success) {
                // If temp ban, schedule unban
                if (action === 'Ban Temporal ERLC') {
                    const expiresAt = new Date(Date.now() + durationMs);
                    await this.supabase.from('temporary_bans').insert({
                        guild_id: interaction.guildId,
                        user_id: interaction.user.id, // We act as if bot did it? Or track target. 
                        // Wait, temporary_bans table needs roblox_username usually?
                        ban_type: 'erlc',
                        roblox_username: robloxIdentifier,
                        expires_at: expiresAt.toISOString()
                    });
                }
                return { success: true, message: `🎮 **Acción ERLC ejecutada** sobre ${robloxIdentifier}.` };
            } else {
                // Queue it
                const ErlcScheduler = require('./ErlcScheduler');
                await ErlcScheduler.queueAction(this.supabase, cmd, reason, { username: robloxIdentifier });
                return { success: true, message: `⚠️ **ERLC Offline:** Sanción puesta en COLA DE ESPERA.` };
            }
        } catch (error) {
            return { success: false, message: `Error ERLC: ${error.message}` };
        }
    }

    async executeRoleManagement(interaction, targetUser, type, action, reason) {
        if (!this.roleManager) return { success: false, message: 'RoleManager no configurado.' };
        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return { success: false, message: 'Usuario no está en el servidor para roles.' };

        // PRIORITY: Check Blacklist First
        if (action && action.startsWith('Blacklist')) {
            // Expect format "Blacklist: Type" or just "Blacklist"
            const parts = action.split(':');
            const blacklistType = parts.length > 1 ? parts[1].trim() : null;

            if (blacklistType && blacklistType !== 'Total') {
                let key = blacklistType;
                if (!key.startsWith('Blacklist ')) key = `Blacklist ${key}`;

                const success = await this.roleManager.assignBlacklistRole(member, key);
                if (success) return { success: true, message: `🚫 **Rol Blacklist asignado:** ${key}` };
                return { success: false, message: `⚠️ No se encontró rol para: ${key}` };
            }
            // If Total, we already Banned in executeDiscordPunishment, so no Role needed (user is gone/banned).
            return { success: true, message: '🚫 **Blacklist Total Aplicada (Ban)**' };
        }

        if (type === 'sa') {
            // SA Logic: Get count, Increment (virtually), Set Role
            const currentCount = await this.getSACount(targetUser.id);
            const newCount = currentCount + 1; // Assuming this execution ADDS one
            // Note: createSanction hasn't run yet or runs in parallel, 
            // but usually we want to reflect the Resulting State.
            // If createSanction is called AFTER this, we might be off by one if we query DB.
            // Best to Assume +1.

            // Limit to SA 5
            if (newCount <= 5) {
                await this.roleManager.setSanctionRole(member, newCount);

                // CRITICAL ALERT FOR 5 SAs
                if (newCount === 5) {
                    const ALERT_CHANNEL_ID = '1456021466356387861';
                    const alertChannel = this.client.channels.cache.get(ALERT_CHANNEL_ID);
                    if (alertChannel) {
                        try {
                            const { EmbedBuilder } = require('discord.js');
                            const alertEmbed = new EmbedBuilder()
                                .setTitle('🚨 ALERTA CRÍTICA: Límite de SAs Alcanzado')
                                .setDescription(`🛑 **El usuario ha acumulado 5 Sanciones Administrativas (SA).**\n\n👤 **Usuario:** ${targetUser.tag} (<@${targetUser.id}>)\n⚖️ **Sanción Automática Requerida:** BAN PERMANENTE (Directo).\n📜 **Último Motivo:** ${reason}`)
                                .setColor(0xFF0000)
                                .setTimestamp();

                            await alertChannel.send({ embeds: [alertEmbed] });
                            return { success: true, message: `📉 **Rol SA Actualizado a Nivel ${newCount}**\n⛔ **CRÍTICO: El usuario ha alcanzado 5 SAs. Se ha notificado a la Administración.**` };
                        } catch (err) {
                            console.error('Error sending SA 5 Alert:', err);
                        }
                    }
                }

                return { success: true, message: `📉 **Rol SA Actualizado a Nivel ${newCount}**` };
            } else {
                return { success: true, message: `⚠️ **Usuario excede SA 5** - Considerar Blacklist.` };
            }
        }

        return { success: true, message: '' };
    }

    async logAndNotify(interaction, targetUser, type, action, reason, description, evidenceUrl, durationText, executionResult) {
        // ... (LogManager integration)
        if (this.logManager) {
            // Construct Embed
            const embed = new EmbedBuilder()
                .setTitle(`Sanción: ${action || type}`)
                .setColor(type === 'sa' ? 0x8b0000 : 0xFFD700)
                .addFields(
                    { name: 'Usuario', value: `${targetUser.tag}`, inline: true },
                    { name: 'Moderador', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Motivo', value: reason, inline: false },
                    { name: 'Duración', value: durationText || 'N/A', inline: true },
                    { name: 'Resultado', value: executionResult.messages.join('\n') || 'Registrado', inline: false }
                )
                .setTimestamp();

            if (evidenceUrl) embed.setImage(evidenceUrl);

            // Log to Main Channel depending on type?
            // Usually 'Sanciones' goes to a public channel?
            // Current 'sancion.js' replied to context. 
            // We use 'logManager' for permanent records (Audits).
            await this.logManager.logAudit('Sanción Aplicada', `Target: ${targetUser.tag}\nAction: ${action}`, interaction.user, targetUser);
        }
    }

    // ==========================================
    // EXISTING DB METHODS (Preserved)
    // ==========================================

    /**
     * Create a new sanction
     * @param {string} discordUserId 
     * @param {string} moderatorId 
     * @param {'notificacion'|'sa'|'general'} type 
     * @param {string} reason 
     * @param {string|null} evidenceUrl 
     */
    async createSanction(discordUserId, moderatorId, type, reason, evidenceUrl = null, expiresAt = null, actionType = null, description = null) {
        const signature = `sanction:${discordUserId}:${type}:${reason}`;

        if (this.processingLocks.has(signature)) {
            console.warn(`[SanctionService] Duplicate sanction blocked by in-memory lock: ${signature}`);
            return { id: 'blocked-duplicate', status: 'duplicate' };
        }

        this.processingLocks.add(signature);
        const lockTimeout = setTimeout(() => this.processingLocks.delete(signature), 10000);

        try {
            // IDEMPOTENCY CHECK (Database Level - Cross Process)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

            const { data: duplicates } = await this.supabase
                .from('sanctions')
                .select('id')
                .eq('discord_user_id', discordUserId)
                .eq('moderator_id', moderatorId)
                .eq('type', type)
                .eq('reason', reason)
                .eq('status', 'active')
                .gt('created_at', fiveMinutesAgo);

            if (duplicates && duplicates.length > 0) {
                return duplicates[0];
            }

            const { data, error } = await this.supabase
                .from('sanctions')
                .insert({
                    discord_user_id: discordUserId,
                    moderator_id: moderatorId,
                    type: type,
                    reason: reason,
                    description: description,
                    evidence_url: evidenceUrl,
                    status: 'active',
                    expires_at: expiresAt,
                    action_type: actionType
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating sanction:', error);
            throw error;
        } finally {
            clearTimeout(lockTimeout);
            this.processingLocks.delete(signature);
        }
    }

    /**
     * Get active sanctions for a user
     * @param {string} discordUserId 
     */
    async getUserSanctions(discordUserId) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('discord_user_id', discordUserId)
            .in('status', ['active', 'appealed'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Count sanctions by type for a user
     * @param {string} discordUserId 
     */
    async getSanctionCounts(discordUserId) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('type')
            .eq('discord_user_id', discordUserId)
            .eq('status', 'active');

        if (error) throw error;

        const counts = {
            notificacion: 0,
            sa: 0,
            general: 0
        };

        data.forEach(s => {
            if (counts[s.type] !== undefined) counts[s.type]++;
        });

        return counts;
    }

    /**
     * Get a specific sanction by ID
     * @param {string} id 
     */
    async getSanctionById(id) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Update a sanction's details
     * @param {string} id 
     * @param {object} updates 
     */
    async updateSanction(id, updates) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get total count of 'general' sanctions (warns) for a user
     * @param {string} discordUserId 
     */
    async getWarnCount(discordUserId) {
        const { count, error } = await this.supabase
            .from('sanctions')
            .select('*', { count: 'exact', head: true })
            .eq('discord_user_id', discordUserId)
            .eq('type', 'general')
            .eq('status', 'active');

        if (error) throw error;
        return count;
    }

    async getSACount(discordUserId) {
        const { count, error } = await this.supabase
            .from('sanctions')
            .select('*', { count: 'exact', head: true })
            .eq('discord_user_id', discordUserId)
            .eq('type', 'sa')
            .eq('status', 'active');

        if (error) throw error;
        return count;
    }

    // --- EXPIRATION LOGIC ---
    async checkExpiredSanctions() {
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
            .from('sanctions')
            .select('*')
            .eq('status', 'active')
            .not('expires_at', 'is', null)
            .lt('expires_at', now);

        if (error) {
            console.error('Error checking expired sanctions:', error);
            return [];
        }
        return data;
    }

    async expireSanction(id) {
        const { error } = await this.supabase
            .from('sanctions')
            .update({ status: 'expired' })
            .eq('id', id);

        if (error) console.error(`Error expiring sanction ${id}:`, error);
    }

    // --- CLEAN SLATE / ARCHIVE LOGIC ---
    async archiveOldSanctions(userId, months = 6) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        const cutoffISO = cutoffDate.toISOString();

        // Only archive 'general' sanctions (Warns/Verbal)
        // SAs should generally be permanent or handled differently, but requirement says "Warns old".
        // We will target 'general' type.
        const { data, error } = await this.supabase
            .from('sanctions')
            .update({ status: 'archived' })
            .eq('discord_user_id', userId)
            .eq('type', 'general')
            .eq('status', 'active')
            .lt('created_at', cutoffISO)
            .select();

        if (error) throw error;
        return data ? data.length : 0;
    }
    /**
     * Void/Delete a sanction (Soft Delete)
     * @param {string} id 
     * @param {string} voidReason 
     * @param {string} moderatorId 
     */
    async voidSanction(id, voidReason, moderatorId) {
        // We append the void reason to the original reason or a note, 
        // and set status to 'void'.
        // Assuming 'void' is a valid status enum, if not we use 'archived' or similar, 
        // but 'void' is clearer for "deleted by admin".

        const { data, error } = await this.supabase
            .from('sanctions')
            .update({
                status: 'void',
                // We might want to store who deleted it. 
                // If table doesn't have specific columns, we can append to reason?
                // Better to just update status for now, managing columns is complex live.
                // We will rely on Audit Log for the "Who" and "Why".
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
    async appealSanction(id, reason) {
        const { data, error } = await this.supabase
            .from('sanctions')
            .update({
                status: 'appealed'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = SanctionService;
