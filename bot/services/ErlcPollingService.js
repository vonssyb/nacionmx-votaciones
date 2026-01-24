const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
const config = require('../config/erlcEconomyEmergency');
// Voice dependencies removed, handled by VoiceSwarmService

class ErlcPollingService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabase
     * @param {import('discord.js').Client} client 
     * @param {import('../services/VoiceSwarmService')} swarmService
     * @param {import('../services/ErlcService')} erlcService
     */
    constructor(supabase, client, swarmService, erlcService) {
        this.supabase = supabase;
        this.client = client;
        this.swarmService = swarmService;
        this.erlcService = erlcService;
        this.isPolling = false;
        this.lastLogTimestamp = Math.floor(Date.now() / 1000) - 60;
        this.SERVER_KEY = process.env.ERLC_SERVER_KEY;
        this.pollingRate = 8000; // Increased to 8s to free up API quota
        this.linkCache = new Map();

        // Command deduplication cache
        this.processedCommands = new Map(); // key: "user:command:timestamp", value: timestamp when processed
        this.DEDUP_WINDOW = 60000; // 60 seconds
    }

    start() {
        if (!this.SERVER_KEY) {
            console.error('❌ [ERLC Service] CRITICAL: ERLC_SERVER_KEY is missing!');
        } else {
            console.log(`✅ [ERLC Service] API Key detected. Starting Polling (8s)...`);
        }
        this.interval = setInterval(() => this.fetchLogs(), this.pollingRate);
        this.cleanupInterval = setInterval(() => this.cleanupDedupCache(), 60000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    }

    cleanupDedupCache() {
        const now = Date.now();
        for (const [key, timestamp] of this.processedCommands.entries()) {
            if (now - timestamp > this.DEDUP_WINDOW) {
                this.processedCommands.delete(key);
            }
        }
    }

    isCommandProcessed(user, command, timestamp) {
        const key = `${user}:${command}:${timestamp}`;
        return this.processedCommands.has(key);
    }

    markCommandProcessed(user, command, timestamp) {
        const key = `${user}:${command}:${timestamp}`;
        this.processedCommands.set(key, Date.now());
    }

    /**
     * Send a private message to a Roblox user in ERLC
     * Now uses the centralized command queue in erlcService
     */
    async sendPM(robloxUser, message) {
        if (!this.erlcService) return;

        // Sanitize message to avoid command injection or issues
        const cleanMsg = message.replace(/[:]/g, '');
        await this.erlcService.runCommand(`:pm ${robloxUser} ${cleanMsg}`);
    }

    async fetchLogs() {
        if (!this.SERVER_KEY) return;

        try {
            const response = await axios.get('https://api.policeroleplay.community/v1/server/commandlogs', {
                headers: { 'Server-Key': this.SERVER_KEY }
            });

            // Success - Reset error counter
            if (this.consecutiveErrors > 0) {
                console.log(`✅ [ERLC Service] Connection restored after ${this.consecutiveErrors} failures.`);
                this.consecutiveErrors = 0;
            }

            const logs = response.data;
            if (!logs || logs.length === 0) return;

            logs.sort((a, b) => a.Timestamp - b.Timestamp);
            const safeFilterTime = Math.floor(Date.now() / 1000) - 300; // 5 min safety

            for (const log of logs) {
                if (log.Timestamp > this.lastLogTimestamp) {
                    if (log.Timestamp > safeFilterTime) {
                        // Check for duplicates before processing
                        const user = (log.Player || "").split(':')[0];
                        if (!this.isCommandProcessed(user, log.Command, log.Timestamp)) {
                            this.markCommandProcessed(user, log.Command, log.Timestamp);
                            await this.processCommand(log);
                        } else {
                            console.log(`[ERLC Service] 🔄 Skipping duplicate: ${log.Command}`);
                        }
                    }
                    if (log.Timestamp > this.lastLogTimestamp) {
                        this.lastLogTimestamp = log.Timestamp;
                    }
                }
            }
        } catch (error) {
            this.consecutiveErrors = (this.consecutiveErrors || 0) + 1;

            // Only log the first error, and then every 10th error to avoid spam
            // 502 = Bad Gateway (Upstream issue)
            // 403 = Forbidden (Invalid Key)
            if (this.consecutiveErrors === 1 || this.consecutiveErrors % 10 === 0) {
                console.error(`[ERLC Service] Polling Error (x${this.consecutiveErrors}): ${error.message} [Code: ${error.response?.status || 'Unknown'}]`);
            }
        }
    }

    async processCommand(log) {
        const content = log.Command;
        const rawPlayer = log.Player || "";
        const robloxUser = rawPlayer.split(':')[0];

        console.log(`[ERLC Service] 📥 Processing: User="${robloxUser}" Cmd="${content}"`);

        // Command Dispatcher Map
        const handlers = [
            {
                prefix: ':log talk ',
                handler: async (msg) => this.handleTalk(robloxUser, msg)
            },
            {
                prefix: ':log vc ',
                handler: async (msg) => this.handleVC(robloxUser, msg)
            },
            {
                prefix: ':log mv ',
                handler: async (msg) => {
                    const parts = msg.split(' ');
                    if (parts.length >= 2) await this.handleStaffMove(robloxUser, parts[0], parts[1]);
                }
            },
            {
                prefix: ':log whisper ',
                handler: async (msg) => this.handleWhisper(robloxUser, msg)
            },
            {
                prefix: ':log vcreate ',
                handler: async (msg) => this.handleVCreate(robloxUser, msg)
            },
            {
                prefix: ':log vcontrol',
                handler: async () => this.handleVControl(robloxUser)
            },
            {
                prefix: ':log vcstats',
                handler: async (msg) => {
                    const target = msg ? msg.trim() : robloxUser;
                    await this.handleVCStats(robloxUser, target);
                }
            },
            {
                prefix: ':log 911 ',
                handler: async (msg) => {
                    const parts = msg.split(' ');
                    await this.handle911(robloxUser, parts[0], parts.slice(1).join(' '));
                }
            },
            {
                prefix: ':log pagar ',
                handler: async (msg) => {
                    const parts = msg.split(' ');
                    if (parts.length >= 3) {
                        await this.handlePagar(robloxUser, parts[0], parseInt(parts[1]), parts.slice(2).join(' '));
                    }
                }
            },
            {
                prefix: ':log cobrar ',
                handler: async (msg) => {
                    const parts = msg.split(' ');
                    if (parts.length >= 3) {
                        await this.handleCobrar(robloxUser, parts[0], parseInt(parts[1]), parts.slice(2).join(' '));
                    }
                }
            },
            {
                prefix: ':log anunciar ',
                handler: async (msg) => this.handleAnuncio(robloxUser, msg)
            },
            {
                prefix: ':log', // Fallback for help or empty
                exact: true,
                handler: async () => this.handleHelp(robloxUser)
            },
            {
                prefix: ':log help',
                exact: true,
                handler: async () => this.handleHelp(robloxUser)
            }
        ];

        const lowerContent = content.toLowerCase();

        for (const cmd of handlers) {
            // Check Exact Match
            if (cmd.exact && lowerContent === cmd.prefix) {
                await cmd.handler(content.substring(cmd.prefix.length).trim());
                return;
            }
            // Check Prefix Match
            if (!cmd.exact && lowerContent.startsWith(cmd.prefix)) {
                // Pass the *original case* content, but stripped of prefix
                // content.substring because we matched based on length of prefix
                await cmd.handler(content.substring(cmd.prefix.length).trim());
                return;
            }
        }
    }

    async handleTalk(robloxUser, message) {
        try {
            const member = await this.getDiscordMember(robloxUser);
            if (!member || !member.voice.channelId) {
                console.log(`[ERLC Service] Talk Ignored: User ${robloxUser} not in VC`);
                return;
            }

            const channelId = member.voice.channelId;
            const channelInfo = voiceConfig.getChannelInfo(channelId);
            if (!channelInfo) {
                console.log(`[ERLC Service] ⚠️ Talk Ignored: CID ${channelId} not in config/whitelist.`);
                return;
            }

            if (channelInfo.noTTS) {
                console.log(`[ERLC Service] ⚠️ Talk Ignored: Channel ${channelInfo.name} has TTS disabled.`);
                return;
            }
            console.log(`[ERLC Service] 🐝 Dispatching to Swarm: "${message}" -> Channel ${channelId}`);

            if (this.swarmService) {
                await this.swarmService.speak(member.guild.id, channelId, `${robloxUser} dice: ${message}`);
            } else {
                console.warn('[ERLC Service] Swarm Service not initialized!');
            }
        } catch (error) {
            console.error(`❌ [ERLC Service] HandleTalk Error:`, error);
        }
    }

    async handleVC(robloxUser, abbreviation) {
        console.log(`[ERLC Service] handleVC called: user="${robloxUser}", abbreviation="${abbreviation}"`);

        const member = await this.getDiscordMember(robloxUser);
        if (!member) {
            console.log(`❌ [ERLC Service] User ${robloxUser} not found in Discord`);
            await this.sendPM(robloxUser, '❌ No tienes DNI. Usa /dni crear en Discord.');
            return;
        }

        if (!member.voice.channelId) {
            console.log(`❌ [ERLC Service] User ${robloxUser} not in voice channel`);
            await this.sendPM(robloxUser, '❌ No estás en un canal de voz.');
            return;
        }

        console.log(`✅ [ERLC Service] User found:${member.user.tag}, current VC: ${member.voice.channelId}`);

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) {
            console.log(`❌ [ERLC Service] Channel alias "${abbreviation}" not found`);
            await this.sendPM(robloxUser, `❌ Canal "${abbreviation}" no encontrado.`);
            return;
        }

        console.log(`✅ [ERLC Service] Target channel ID: ${targetId}`);

        // Check if user is Junta Directiva (bypass all restrictions)
        const isJD = voiceConfig.ROLES.JUNTA_DIRECTIVA.some(id => member.roles.cache.has(id));

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        if (channelInfo && channelInfo.requiredRole && !isJD) {
            const allowedRoles = voiceConfig.ROLES[channelInfo.requiredRole];
            if (Array.isArray(allowedRoles)) {
                if (!member.roles.cache.some(role => allowedRoles.includes(role.id))) {
                    console.log(`❌ [ERLC Service] User missing required role: ${channelInfo.requiredRole}`);
                    await this.sendPM(robloxUser, `⛔ No tienes permisos para acceder a ese canal.`);
                    return;
                }
            } else if (allowedRoles && !member.roles.cache.has(allowedRoles)) {
                console.log(`❌ [ERLC Service] User missing required role: ${channelInfo.requiredRole}`);
                await this.sendPM(robloxUser, `⛔ No tienes permisos para acceder a ese canal.`);
                return;
            }
        }

        try {
            await member.voice.setChannel(targetId);
            console.log(`✅ [ERLC Service] Moved ${robloxUser} to ${channelInfo?.name || targetId}`);
            await this.sendPM(robloxUser, `✅ Movido a ${channelInfo?.name || abbreviation}`);
        } catch (error) {
            console.error(`❌ [ERLC Service] Move Failed:`, error.message);
            await this.sendPM(robloxUser, `❌ Error moviéndote: ${error.message}`);
        }
    }

    async handleStaffMove(staffUser, targetUser, abbreviation) {
        const staffMember = await this.getDiscordMember(staffUser);
        if (!staffMember) {
            await this.sendPM(staffUser, '❌ No tienes DNI. Usa /dni crear en Discord.');
            return;
        }

        const isStaff = voiceConfig.ROLES.STAFF.some(id => staffMember.roles.cache.has(id));
        const isJD = voiceConfig.ROLES.JUNTA_DIRECTIVA.some(id => staffMember.roles.cache.has(id));
        if (!isStaff && !isJD) {
            await this.sendPM(staffUser, '⛔ No tienes permisos de Staff.');
            return;
        }

        // Resolve partial username
        const resolvedTarget = await this.resolvePartialUsername(targetUser);
        if (!resolvedTarget) {
            await this.sendPM(staffUser, `❌ No encontré "${targetUser}" o hay múltiples coincidencias. Sé más específico.`);
            return;
        }

        const targetMember = await this.getDiscordMember(resolvedTarget);
        if (!targetMember) {
            await this.sendPM(staffUser, `❌ ${resolvedTarget} no está vinculado en Discord.`);
            return;
        }

        if (!targetMember.voice.channelId) {
            await this.sendPM(staffUser, `❌ ${resolvedTarget} no está en un canal de voz.`);
            return;
        }

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) {
            await this.sendPM(staffUser, `❌ Canal "${abbreviation}" no encontrado.`);
            return;
        }

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        await targetMember.voice.setChannel(targetId).catch(console.error);
        await this.sendPM(staffUser, `✅ Moví a ${resolvedTarget} al canal ${channelInfo?.name || abbreviation}`);
        console.log(`[ERLC Service] Staff Move: ${staffUser} moved ${resolvedTarget} (from "${targetUser}")`);
    }

    async resolvePartialUsername(partial) {
        // 1. Check exact match first
        const exactCheck = await this.getDiscordMember(partial);
        if (exactCheck) return partial;

        // 2. Search for partial matches in database
        const search = `%${partial}%`;

        // Search in roblox_discord_links
        const { data: links } = await this.supabase
            .from('roblox_discord_links')
            .select('roblox_username')
            .ilike('roblox_username', search);

        // Search in citizens
        const { data: citizens } = await this.supabase
            .from('citizens')
            .select('roblox_username')
            .ilike('roblox_username', search)
            .not('roblox_username', 'is', null);

        // Combine and deduplicate results
        const allMatches = new Set();
        links?.forEach(l => l.roblox_username && allMatches.add(l.roblox_username.toLowerCase()));
        citizens?.forEach(c => c.roblox_username && allMatches.add(c.roblox_username.toLowerCase()));

        const matches = Array.from(allMatches);

        if (matches.length === 1) {
            // Unique match found!
            const resolved = matches[0];
            console.log(`[ERLC Service] ✅ Partial Username Resolved: "${partial}" → "${resolved}"`);
            return resolved;
        } else if (matches.length > 1) {
            console.log(`[ERLC Service] ⚠️ Multiple matches for "${partial}":`, matches.slice(0, 5));
            return null; // Ambiguous
        } else {
            console.log(`[ERLC Service] ❌ No matches for "${partial}"`);
            return null; // Not found
        }
    }

    async getDiscordMember(robloxUser) {
        if (this.linkCache.has(robloxUser.toLowerCase())) {
            const id = this.linkCache.get(robloxUser.toLowerCase());
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            return await guild.members.fetch(id).catch(() => null);
        }

        let discordId = null;

        const { data: link } = await this.supabase
            .from('roblox_discord_links')
            .select('discord_user_id')
            .ilike('roblox_username', robloxUser)
            .maybeSingle();

        if (link) discordId = link.discord_user_id;

        if (!discordId) {
            const { data: citizen } = await this.supabase
                .from('citizens')
                .select('discord_id')
                .ilike('roblox_username', robloxUser)
                .maybeSingle();
            if (citizen) discordId = citizen.discord_id;
        }

        if (discordId) {
            this.linkCache.set(robloxUser.toLowerCase(), discordId);
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            return await guild.members.fetch(discordId).catch(() => null);
        }

        try {
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            if (guild) {
                const results = await guild.members.search({ query: robloxUser, limit: 10 });
                const cleanName = (name) => {
                    return name.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
                        .replace(/^\d+\s*\|\s*/, '').replace(/\s*\|\s*.*$/, '').trim().toLowerCase();
                };
                const target = robloxUser.toLowerCase();
                const member = results.find(m => {
                    return m.user.username.toLowerCase() === target || cleanName(m.displayName) === target;
                });

                if (member) {
                    this.linkCache.set(robloxUser.toLowerCase(), member.id);
                    return member;
                }
            }
        } catch (e) {
            console.error('[ERLC Service] Username Fallback Error:', e.message);
        }
        return null;
    }

    // ==============================================
    // EMERGENCY & ECONOMY HANDLERS
    // ==============================================

    async handle911(caller, location, description) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const config = require('../config/erlcEconomyEmergency');

        try {
            const callerMember = await this.getDiscordMember(caller);
            const callerDiscordId = callerMember?.id || null;

            // Create emergency record in DB
            const { data: emergency, error } = await this.supabase
                .from('emergency_calls')
                .insert({
                    caller_roblox: caller,
                    caller_discord_id: callerDiscordId,
                    location: location,
                    emergency_description: description
                })
                .select()
                .single();

            if (error) throw error;

            // Create embed
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            const channel = await guild.channels.fetch(config.CHANNELS.EMERGENCY_911);

            const embed = new EmbedBuilder()
                .setTitle('🚨 **EMERGENCIA 911**')
                .setColor('#FF0000')
                .setDescription(`**📍 Ubicación:** ${location}\n**📝 Descripción:** ${description}`)
                .addFields(
                    { name: '👤 Reportante', value: callerMember ? `<@${callerDiscordId}> (${caller})` : caller, inline: true },
                    { name: '🕐 Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: `ID Emergencia: ${emergency.id}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`emergency_respond_${emergency.id}`)
                    .setLabel('🚨 Unirse a Emergencia')
                    .setStyle(ButtonStyle.Success)
            );

            // Ping emergency roles
            const rolesToPing = config.EMERGENCY_CATEGORIES.todos.map(roleKey => `<@&${config.EMERGENCY_ROLES[roleKey]}>`).join(' ');


            const message = await channel.send({
                content: `${rolesToPing}\n🚨 **EMERGENCIA ACTIVA**`,
                embeds: [embed],
                components: [row]
            });

            // Update DB with message ID
            await this.supabase
                .from('emergency_calls')
                .update({ message_id: message.id, channel_id: channel.id })
                .eq('id', emergency.id);

            // Confirm to caller
            await this.sendPM(caller, `✅ Tu emergencia ha sido reportada. ID: ${emergency.id}. Los servicios de emergencia han sido notificados.`);

            // Broadcast to emergency voice channels
            await this.broadcastEmergencyToVoice(location, description);

            console.log(`[ERLC Service] 🚨 Emergency ${emergency.id} created by ${caller}`);

        } catch (error) {
            console.error('[ERLC Service] handle911 Error:', error);
            await this.sendPM(caller, '❌ Error reportando emergencia. Intenta de nuevo.');
        }
    }

    async broadcastEmergencyToVoice(location, description) {
        try {
            const path = require('path');
            const fs = require('fs');
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            const emergencyChannels = config.EMERGENCY_VOICE_CHANNELS;

            const ttsMessage = `Hay una emergencia en ${location} con el asunto ${description}`;
            const soundPath = path.join(__dirname, '../assets/sounds/911_alert.mp4');

            for (const channelId of emergencyChannels) {
                const voiceChannel = guild.channels.cache.get(channelId);

                // Only broadcast if channel exists and has members
                if (voiceChannel && voiceChannel.members.size > 0) {
                    console.log(`[ERLC Service] 📢 Broadcasting to ${voiceChannel.name} (${voiceChannel.members.size} members)`);

                    // Dispatch to VoiceSwarm
                    if (this.swarmService) {
                        // First: Play MP4 alert sound if it exists
                        if (fs.existsSync(soundPath)) {
                            try {
                                console.log(`[ERLC Service] 🔊 Playing alert sound in ${voiceChannel.name}`);
                                await this.swarmService.dispatchAudioFile(channelId, soundPath);

                                // Wait for sound to finish (~3 seconds)
                                await new Promise(resolve => setTimeout(resolve, 3500));
                            } catch (err) {
                                console.error(`[ERLC Service] Failed to play alert sound: ${err.message}`);
                            }
                        }

                        // Then: Play TTS message
                        console.log(`[ERLC Service] 🗣️ Playing TTS: "${ttsMessage}"`);
                        await this.swarmService.speak(guild.id, channelId, ttsMessage);
                    }
                } else {
                    console.log(`[ERLC Service] ⏭️ Skipping ${channelId} (no members or not found)`);
                }
            }

        } catch (error) {
            console.error('[ERLC Service] broadcastEmergencyToVoice Error:', error);
        }
    }

    async handlePagar(sender, targetUser, amount, concept) {
        const config = require('../config/erlcEconomyEmergency');

        try {
            // Validate amount
            if (isNaN(amount) || amount < config.TRANSACTION_LIMITS.MIN_AMOUNT || amount > config.TRANSACTION_LIMITS.MAX_AMOUNT) {
                return await this.sendPM(sender, `❌ Cantidad inválida. Rango: $${config.TRANSACTION_LIMITS.MIN_AMOUNT} - $${config.TRANSACTION_LIMITS.MAX_AMOUNT}`);
            }

            // Resolve target user
            const resolvedTarget = await this.resolvePartialUsername(targetUser);
            if (!resolvedTarget) {
                return await this.sendPM(sender, `❌ No encontré "${targetUser}" o hay múltiples coincidencias.`);
            }

            // Get both members
            const senderMember = await this.getDiscordMember(sender);
            const targetMember = await this.getDiscordMember(resolvedTarget);

            if (!senderMember) {
                return await this.sendPM(sender, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            if (!targetMember) {
                return await this.sendPM(sender, `❌ ${resolvedTarget} no está vinculado en Discord.`);
            }

            // Check sender balance
            const billingService = this.client.services.billing;
            const senderBalance = await billingService.ubService.getUserBalance(process.env.GUILD_ID, senderMember.id);

            if ((senderBalance.cash || 0) < amount) {
                return await this.sendPM(sender, `❌ Fondos insuficientes. Tienes: $${(senderBalance.cash || 0).toLocaleString()}, necesitas: $${amount.toLocaleString()}`);
            }

            // Execute transaction
            await billingService.ubService.removeMoney(process.env.GUILD_ID, senderMember.id, amount, `[ERLC Pago] ${concept}`, 'cash');
            await billingService.ubService.addMoney(process.env.GUILD_ID, targetMember.id, amount, `[ERLC Pago] De ${sender}`, 'cash');

            // Log transaction
            await this.supabase.from('erlc_transactions').insert({
                transaction_type: 'payment',
                sender_roblox: sender,
                sender_discord_id: senderMember.id,
                receiver_roblox: resolvedTarget,
                receiver_discord_id: targetMember.id,
                amount: amount,
                concept: concept
            });

            // Confirmations
            await this.sendPM(sender, `✅ Pagaste $${amount.toLocaleString()} a ${resolvedTarget}. Concepto: ${concept}`);
            await this.sendPM(resolvedTarget, `💰 Recibiste $${amount.toLocaleString()} de ${sender}. Concepto: ${concept}`);

            console.log(`[ERLC Service] 💵 Payment: ${sender} → ${resolvedTarget} ($${amount})`);

        } catch (error) {
            console.error('[ERLC Service] handlePagar Error:', error);
            await this.sendPM(sender, '❌ Error procesando pago.');
        }
    }

    async handleCobrar(requester, targetUser, amount, concept) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const config = require('../config/erlcEconomyEmergency');

        try {
            // Validate amount
            if (isNaN(amount) || amount < config.TRANSACTION_LIMITS.MIN_AMOUNT || amount > config.TRANSACTION_LIMITS.MAX_AMOUNT) {
                return await this.sendPM(requester, `❌ Cantidad inválida. Rango: $${config.TRANSACTION_LIMITS.MIN_AMOUNT} - $${config.TRANSACTION_LIMITS.MAX_AMOUNT}`);
            }

            // Resolve target user
            const resolvedTarget = await this.resolvePartialUsername(targetUser);
            if (!resolvedTarget) {
                return await this.sendPM(requester, `❌ No encontré "${targetUser}" o hay múltiples coincidencias.`);
            }

            // Get both members
            const requesterMember = await this.getDiscordMember(requester);
            const debtorMember = await this.getDiscordMember(resolvedTarget);

            if (!requesterMember) {
                return await this.sendPM(requester, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            if (!debtorMember) {
                return await this.sendPM(requester, `❌ ${resolvedTarget} no está vinculado en Discord.`);
            }

            // Create payment request in DB
            const { data: request, error } = await this.supabase
                .from('payment_requests')
                .insert({
                    requester_roblox: requester,
                    requester_discord_id: requesterMember.id,
                    debtor_roblox: resolvedTarget,
                    debtor_discord_id: debtorMember.id,
                    amount: amount,
                    concept: concept
                })
                .select()
                .single();

            if (error) throw error;

            // Create embed with buttons
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            const channel = await guild.channels.fetch(config.CHANNELS.PAYMENT_REQUESTS);

            const embed = new EmbedBuilder()
                .setTitle('💰 Solicitud de Cobro')
                .setColor('#FFD700')
                .setDescription(`**${requester}** está cobrando a **${resolvedTarget}**`)
                .addFields(
                    { name: '💵 Monto', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '📝 Concepto', value: concept || 'Sin especificar', inline: true },
                    { name: '⏰ Expira', value: '<t:' + Math.floor((Date.now() + 300000) / 1000) + ':R>', inline: true }
                )
                .setFooter({ text: `ID: ${request.id} | ${resolvedTarget}, tienes 5 minutos para responder` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`payment_accept_${request.id}`)
                    .setLabel(`✅ Aceptar Pago ($${amount.toLocaleString()})`)
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`payment_reject_${request.id}`)
                    .setLabel('❌ Rechazar')
                    .setStyle(ButtonStyle.Danger)
            );

            const message = await channel.send({
                content: `<@${debtorMember.id}> tienes una solicitud de cobro`,
                embeds: [embed],
                components: [row]
            });

            // Update DB with message ID
            await this.supabase
                .from('payment_requests')
                .update({ message_id: message.id, channel_id: channel.id })
                .eq('id', request.id);

            // Confirmations
            await this.sendPM(requester, `✅ Solicitud de cobro enviada a ${resolvedTarget} por $${amount.toLocaleString()}`);
            await this.sendPM(resolvedTarget, `💰 ${requester} te está cobrando $${amount.toLocaleString()}. Concepto: ${concept}. Ve a Discord para aceptar/rechazar.`);

            console.log(`[ERLC Service] 💳 Charge request ${request.id}: ${requester} → ${resolvedTarget} ($${amount})`);

        } catch (error) {
            console.error('[ERLC Service] handleCobrar Error:', error);
            await this.sendPM(requester, '❌ Error enviando solicitud.');
        }
    }

    async handleAnuncio(robloxUser, message) {
        console.log(`[ERLC Service] handleAnuncio called: user="${robloxUser}", msg="${message}"`);

        const member = await this.getDiscordMember(robloxUser);
        if (!member) {
            await this.sendPM(robloxUser, '❌ No estás vinculado en Discord. Usa /dni crear.');
            return;
        }

        const isStaff = voiceConfig.ROLES.STAFF.some(id => member.roles.cache.has(id));
        const isJD = voiceConfig.ROLES.JUNTA_DIRECTIVA.some(id => member.roles.cache.has(id));

        if (!isStaff && !isJD) {
            await this.sendPM(robloxUser, '⛔ No tienes permisos de Staff.');
            return;
        }

        const announcement = `ANUNCIO DE STAFF: ${message}`;
        const guildId = member.guild.id;

        if (!this.swarmService) {
            await this.sendPM(robloxUser, '❌ Servicio de voz no disponible.');
            return;
        }

        // 1. Roblox Announcement (:h) - IMMEDIATE & NON-BLOCKING (with Priority)
        if (this.erlcService) {
            this.erlcService.runCommand(`:h ${announcement}`, true).catch(e =>
                console.error('[ERLC Service] Non-blocking Roblox error:', e.message)
            );
        }

        // 2. INSTANT Channel Discovery (using Channel Members)
        const excludeKeywords = ['Canal de Espera', 'Junta Directiva', 'Staff', 'Soporte'];
        const targetIds = ['1459640433297588401', '1412967056730755143', '1412967017639575562', '1412927576879661207', '1398525215675252872'];

        console.log(`[ERLC Polling] --- START VOICE DISCOVERY AUDIT ---`);

        const allVoiceChannels = member.guild.channels.cache.filter(c => c.isVoiceBased());
        console.log(`[ERLC Polling] Total Voice Channels Visible: ${allVoiceChannels.size}`);

        const channelsToNotify = [];

        allVoiceChannels.forEach(channel => {
            const humans = channel.members.filter(m => !m.user.bot);
            const isExcluded = excludeKeywords.some(keyword => channel.name.includes(keyword));
            const isTarget = targetIds.includes(channel.id);

            if (isTarget || humans.size > 0) {
                const canView = channel.viewable;
                const canConnect = channel.joinable;
                console.log(`[ERLC Polling] Audit VC: ${channel.name} (${channel.id}) | Humans: ${humans.size} | Excluded: ${isExcluded} | Viewable: ${canView} | Joinable: ${canConnect}`);

                if (isTarget && humans.size === 0) {
                    console.log(`[ERLC Polling] ⚠️ Target channel ${channel.name} is EMPTY according to bot cache.`);
                }
                if (isTarget && !canConnect) {
                    console.log(`[ERLC Polling] ❌ Bot CANNOT CONNECT to target channel ${channel.name}. Check permissions.`);
                }
            }

            if (humans.size > 0 && !isExcluded) {
                console.log(`[ERLC Polling] ✅ Including: ${channel.name}`);
                channelsToNotify.push(channel.id);
            }
        });

        console.log(`[ERLC Polling] --- END VOICE DISCOVERY AUDIT (Total: ${channelsToNotify.length}) ---`);

        if (channelsToNotify.length === 0) {
            console.warn('[ERLC Polling] NO active channels found for announcement!');
            return;
        }

        await this.sendPM(robloxUser, `⚡ Iniciando anuncio ultra-rápido en Roblox y ${channelsToNotify.length} canales activos...`);

        // 3. Parallel Broadcast (Optimized Swarm)
        const broadcastPromises = channelsToNotify.map(channelId =>
            this.swarmService.speak(guildId, channelId, announcement)
                .then(() => true)
                .catch(err => {
                    console.error(`[ERLC Service] Anuncio error in ${channelId}:`, err.message);
                    return false;
                })
        );

        await Promise.all(broadcastPromises);

        await this.sendPM(robloxUser, `✅ Anuncio emitido en voice channels y Roblox (:h).`);
        console.log(`[ERLC Service] 📢 Broadcast by ${robloxUser}: "${message}"`);
    }

    async handleWhisper(robloxUser, targetUser) {
        try {
            const member = await this.getDiscordMember(robloxUser);
            if (!member) {
                return await this.sendPM(robloxUser, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            if (!member.voice.channelId) {
                return await this.sendPM(robloxUser, '❌ Debes estar en un canal de voz.');
            }

            // Resolve target user
            const resolvedTarget = await this.resolvePartialUsername(targetUser);
            if (!resolvedTarget) {
                return await this.sendPM(robloxUser, `❌ No encontré "${targetUser}".`);
            }

            const targetMember = await this.getDiscordMember(resolvedTarget);
            if (!targetMember || !targetMember.voice.channelId) {
                return await this.sendPM(robloxUser, `❌ ${resolvedTarget} no está en voz.`);
            }

            await this.sendPM(robloxUser, `🤫 Iniciando whisper con ${resolvedTarget}... Ve a Discord.`);

            // Trigger Discord whisper command via webhook or direct execution
            // For now, just notify. Full implementation would need Discord integration
            console.log(`[ERLC Service] 🤫 Whisper request: ${robloxUser} → ${resolvedTarget}`);

        } catch (error) {
            console.error('[ERLC Service] handleWhisper Error:', error);
            await this.sendPM(robloxUser, '❌ Error iniciando whisper.');
        }
    }

    async handleVCreate(robloxUser, channelName) {
        try {
            const member = await this.getDiscordMember(robloxUser);
            if (!member) {
                return await this.sendPM(robloxUser, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            if (!member.voice.channelId) {
                return await this.sendPM(robloxUser, '❌ Debes estar en un canal de voz.');
            }

            await this.sendPM(robloxUser, `🎨 Creando canal "${channelName}"... Ve a Discord.`);
            console.log(`[ERLC Service] 🎨 VCreate request: ${robloxUser} → "${channelName}"`);

        } catch (error) {
            console.error('[ERLC Service] handleVCreate Error:', error);
            await this.sendPM(robloxUser, '❌ Error creando canal.');
        }
    }

    async handleVControl(robloxUser) {
        try {
            const member = await this.getDiscordMember(robloxUser);
            if (!member) {
                return await this.sendPM(robloxUser, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            if (!member.voice.channelId) {
                return await this.sendPM(robloxUser, '❌ Debes estar en un canal de voz.');
            }

            const channel = member.voice.channel;
            const memberCount = channel.members.filter(m => !m.user.bot).size;

            await this.sendPM(robloxUser, `🎙️ ${channel.name} | ${memberCount} usuarios conectados. Ve a Discord para más opciones.`);
            console.log(`[ERLC Service] 🎙️ VControl request: ${robloxUser} in ${channel.name}`);

        } catch (error) {
            console.error('[ERLC Service] handleVControl Error:', error);
            await this.sendPM(robloxUser, '❌ Error obteniendo info del canal.');
        }
    }

    async handleVCStats(requester, targetUser) {
        try {
            const member = await this.getDiscordMember(requester);
            if (!member) {
                return await this.sendPM(requester, '❌ No tienes DNI. Usa /dni crear en Discord.');
            }

            // If checking another user, resolve them
            let targetMember = member;
            let displayName = requester;

            if (targetUser && targetUser !== requester) {
                const resolved = await this.resolvePartialUsername(targetUser);
                if (!resolved) {
                    return await this.sendPM(requester, `❌ No encontré "${targetUser}".`);
                }
                targetMember = await this.getDiscordMember(resolved);
                displayName = resolved;
            }

            if (!targetMember) {
                return await this.sendPM(requester, `❌ ${displayName} no está vinculado.`);
            }

            // Get stats from database
            const { data: stats } = await this.supabase
                .rpc('get_user_voice_stats', { p_user_id: targetMember.id });

            if (!stats || stats.length === 0) {
                return await this.sendPM(requester, `📊 ${displayName} no tiene estadísticas de voz aún.`);
            }

            const s = stats[0];
            const hours = Math.floor((s.total_time_seconds || 0) / 3600);
            const minutes = Math.floor(((s.total_time_seconds || 0) % 3600) / 60);

            const message =
                `📊 STATS DE VOZ - ${displayName}:\n` +
                `⏱️ Tiempo total: ${hours}h ${minutes}m\n` +
                `🎯 Sesiones: ${s.total_sessions || 0}\n` +
                `📈 Promedio: ${Math.floor((s.avg_duration_minutes || 0))} min\n` +
                `🏆 Más largo: ${Math.floor((s.longest_session_minutes || 0))} min`;

            await this.sendPM(requester, message);
            console.log(`[ERLC Service] 📊 VCStats: ${requester} checked ${displayName}`);

        } catch (error) {
            console.error('[ERLC Service] handleVCStats Error:', error);
            await this.sendPM(requester, '❌ Error obteniendo estadísticas.');
        }
    }

    async handleHelp(robloxUser) {
        const helpMessage =
            `🛠️ COMANDOS NACIÓN MX:\n` +
            `• :log talk [msj] - Habla en tu canal\n` +
            `• :log vc [alias] - Muévete (pg, p1, cg, etc)\n` +
            `• :log whisper [user] - Whisper privado\n` +
            `• :log vcreate [nombre] - Crear canal\n` +
            `• :log vcontrol - Info del canal\n` +
            `• :log vcstats - Tus estadísticas\n` +
            `• :log pagar [user] [amt] [motivo]\n` +
            `• :log cobrar [user] [amt] [motivo]\n` +
            `• :log anunciar [msj] - (Staff Only)`;

        await this.sendPM(robloxUser, helpMessage);
    }
}

module.exports = ErlcPollingService;
