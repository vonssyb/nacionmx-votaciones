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
        const member = await this.getDiscordMember(robloxUser);
        if (!member || !member.voice.channelId) return;

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) return;

        const channelInfo = voiceConfig.getChannelInfo(targetId);
        if (channelInfo && channelInfo.requiredRole) {
            const roleId = voiceConfig.ROLES[channelInfo.requiredRole];
            if (roleId && !member.roles.cache.has(roleId)) return;
        }

        try {
            await member.voice.setChannel(targetId);
            console.log(`✅ [ERLC Service] Moved ${robloxUser} to ${targetId}`);
        } catch (error) {
            console.error(`❌ [ERLC Service] Move Failed:`, error.message);
        }
    }

    async handleStaffMove(staffUser, targetUser, abbreviation) {
        const staffMember = await this.getDiscordMember(staffUser);
        if (!staffMember) return;

        const isStaff = staffMember.roles.cache.has(voiceConfig.ROLES.STAFF);
        const isJD = staffMember.roles.cache.has(voiceConfig.ROLES.JUNTA_DIRECTIVA);
        if (!isStaff && !isJD) return;

        // Resolve partial username
        const resolvedTarget = await this.resolvePartialUsername(targetUser);
        if (!resolvedTarget) {
            console.log(`[ERLC Service] ❌ Could not resolve "${targetUser}".`);
            return;
        }

        const targetMember = await this.getDiscordMember(resolvedTarget);
        if (!targetMember || !targetMember.voice.channelId) return;

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) return;

        await targetMember.voice.setChannel(targetId).catch(console.error);
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
}

module.exports = ErlcPollingService;
