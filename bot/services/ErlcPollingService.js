const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
// Voice dependencies removed, handled by VoiceSwarmService

class ErlcPollingService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabase
     * @param {import('discord.js').Client} client 
     * @param {import('../services/VoiceSwarmService')} swarmService
     */
    constructor(supabase, client, swarmService) {
        this.supabase = supabase;
        this.client = client;
        this.swarmService = swarmService;
        this.isPolling = false;
        this.lastLogTimestamp = Math.floor(Date.now() / 1000) - 60;
        this.SERVER_KEY = process.env.ERLC_SERVER_KEY;
        this.pollingRate = 3000;
        this.linkCache = new Map();
    }

    start() {
        if (!this.SERVER_KEY) {
            console.error('❌ [ERLC Service] CRITICAL: ERLC_SERVER_KEY is missing!');
        } else {
            console.log(`✅ [ERLC Service] API Key detected. Starting Polling...`);
        }
        this.interval = setInterval(() => this.fetchLogs(), this.pollingRate);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    /**
     * Send a private message to a Roblox user in ERLC
     * @param {string} robloxUser - Roblox username (without user ID)
     * @param {string} message - Message to send
     */
    async sendPM(robloxUser, message) {
        if (!this.SERVER_KEY) return;

        try {
            await axios.post(
                'https://api.policeroleplay.community/v1/server/command',
                { command: `:pm ${robloxUser} ${message}` },
                { headers: { 'Server-Key': this.SERVER_KEY } }
            );
            console.log(`[ERLC Service] 📨 Sent PM to ${robloxUser}: "${message}"`);
        } catch (error) {
            console.error(`[ERLC Service] Failed to send PM to ${robloxUser}:`, error.message);
        }
    }

    async fetchLogs() {
        if (!this.SERVER_KEY) return;

        try {
            const response = await axios.get('https://api.policeroleplay.community/v1/server/commandlogs', {
                headers: { 'Server-Key': this.SERVER_KEY }
            });

            const logs = response.data;
            if (!logs || logs.length === 0) return;

            logs.sort((a, b) => a.Timestamp - b.Timestamp);
            const safeFilterTime = Math.floor(Date.now() / 1000) - 300; // 5 min safety

            for (const log of logs) {
                if (log.Timestamp > this.lastLogTimestamp) {
                    if (log.Timestamp > safeFilterTime) {
                        await this.processCommand(log);
                    }
                    if (log.Timestamp > this.lastLogTimestamp) {
                        this.lastLogTimestamp = log.Timestamp;
                    }
                }
            }
        } catch (error) {
            console.error('[ERLC Service] Polling Error:', error.message);
        }
    }

    async processCommand(log) {
        const content = log.Command;
        const rawPlayer = log.Player || "";
        const robloxUser = rawPlayer.split(':')[0];

        console.log(`[ERLC Service] 📥 Processing: User="${robloxUser}" Cmd="${content}"`);

        if (content.toLowerCase().startsWith(':log talk ')) {
            const message = content.substring(10).trim();
            await this.handleTalk(robloxUser, message);
        } else if (content.toLowerCase().startsWith(':log vc ')) {
            const abr = content.substring(8).trim();
            await this.handleVC(robloxUser, abr);
        } else if (content.toLowerCase().startsWith(':log mv ')) {
            const parts = content.substring(8).trim().split(' ');
            if (parts.length >= 2) {
                const targetUser = parts[0];
                const channelAbr = parts[1];
                await this.handleStaffMove(robloxUser, targetUser, channelAbr);
            }
        } else if (content.toLowerCase().startsWith(':911 ')) {
            const parts = content.substring(5).trim().split(' ');
            const location = parts[0];
            const description = parts.slice(1).join(' ');
            await this.handle911(robloxUser, location, description);
        } else if (content.toLowerCase().startsWith(':pagar ')) {
            const parts = content.substring(7).trim().split(' ');
            if (parts.length >= 3) {
                const targetUser = parts[0];
                const amount = parseInt(parts[1]);
                const concept = parts.slice(2).join(' ');
                await this.handlePagar(robloxUser, targetUser, amount, concept);
            }
        } else if (content.toLowerCase().startsWith(':cobrar ')) {
            const parts = content.substring(8).trim().split(' ');
            if (parts.length >= 3) {
                const targetUser = parts[0];
                const amount = parseInt(parts[1]);
                const concept = parts.slice(2).join(' ');
                await this.handleCobrar(robloxUser, targetUser, amount, concept);
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
            if (!channelInfo) return; // Whitelist check

            if (channelInfo.noTTS) {
                console.log(`[ERLC Service] Talk Ignored: Channel ${channelInfo.name} has TTS disabled.`);
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
            await this.sendPM(robloxUser, '❌ No estás vinculado. Usa /fichar vincular en Discord.');
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

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        if (channelInfo && channelInfo.requiredRole) {
            const roleId = voiceConfig.ROLES[channelInfo.requiredRole];
            if (roleId && !member.roles.cache.has(roleId)) {
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
            await this.sendPM(staffUser, '❌ No estás vinculado. Usa /fichar vincular en Discord.');
            return;
        }

        const isStaff = staffMember.roles.cache.has(voiceConfig.ROLES.STAFF);
        const isJD = staffMember.roles.cache.has(voiceConfig.ROLES.JUNTA_DIRECTIVA);
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
                    .setLabel('✅ Atendiendo')
                    .setStyle(ButtonStyle.Success)
            );

            // Ping emergency roles
            const rolesToPing = config.EMERGENCY_CATEGORIES.todos.map(roleKey => `<@&${config.EMERGENCY_ROLES[roleKey]}>`).join(' ');

            // Send alert sound first (if available)
            const soundPath = require('path').join(__dirname, '../assets/sounds/911_alert.mp4');
            const fs = require('fs');

            if (fs.existsSync(soundPath)) {
                await channel.send({
                    files: [{
                        attachment: soundPath,
                        name: '911_alert.mp4'
                    }]
                });
            }

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

            console.log(`[ERLC Service] 🚨 Emergency ${emergency.id} created by ${caller}`);

        } catch (error) {
            console.error('[ERLC Service] handle911 Error:', error);
            await this.sendPM(caller, '❌ Error reportando emergencia. Intenta de nuevo.');
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
                return await this.sendPM(sender, '❌ No estás vinculado. Usa /fichar vincular en Discord.');
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
                return await this.sendPM(requester, '❌ No estás vinculado. Usa /fichar vincular en Discord.');
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
            await this.sendPM(requester, '❌ Error creando solicitud de cobro.');
        }
    }
}

module.exports = ErlcPollingService;
