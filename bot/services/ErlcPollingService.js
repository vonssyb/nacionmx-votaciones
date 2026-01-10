const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
// Voice dependencies removed here, now handled by VoiceSwarmService

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

            // Sort & Filter
            logs.sort((a, b) => a.Timestamp - b.Timestamp);

            // Ignore logs older than lookback (safety)
            const safeFilterTime = Math.floor(Date.now() / 1000) - 300;

            for (const log of logs) {
                if (log.Timestamp > this.lastLogTimestamp) {
                    // Only process recent logs (not older than 5 mins)
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

            console.log(`[ERLC Service] 🐝 Dispatching to Swarm: "${message}" -> Channel ${channelId}`);

            // DELEGATE TO SWARM
            if (this.swarmService) {
                await this.swarmService.speak(member.guild.id, channelId, `${robloxUser} dice: ${message}`);
            } else {
                console.warn('[ERLC Service] Swarm Service not initialized!');
            }

        } catch (error) {
            console.error(`❌ [ERLC Service] HandleTalk Error:`, error);
        }
    }

    // ... (Existing handleVC, handleStaffMove, getDiscordMember) ...

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

        const voiceConfig = require('../config/erlcVoiceChannels');
        const isStaff = staffMember.roles.cache.has(voiceConfig.ROLES.STAFF);
        const isJD = staffMember.roles.cache.has(voiceConfig.ROLES.JUNTA_DIRECTIVA);
        if (!isStaff && !isJD) return;

        const targetMember = await this.getDiscordMember(targetUser);
        if (!targetMember || !targetMember.voice.channelId) return;

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) return;

        await targetMember.voice.setChannel(targetId).catch(console.error);
        console.log(`[ERLC Service] Staff Move: ${staffUser} moved ${targetUser}`);
    }

    async getDiscordMember(robloxUser) {
        if (this.linkCache.has(robloxUser.toLowerCase())) {
            const id = this.linkCache.get(robloxUser.toLowerCase());
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
            return await guild.members.fetch(id).catch(() => null);
        }

        // Logic here is good, but shortened for brevity in this replacement block.
        // Wait, I should keep the robust logic of getDiscordMember.
        // It's safer to not replace getDiscordMember if I can avoid it.
        // But getDiscordMember is mixed with handleTalk in the file...
        // Actually, getDiscordMember is after handleTalk. 
        // I will truncate my replacement BEFORE getDiscordMember if possible.
        // The previous tool call showed getDiscordMember starts at line 161.
        // My replacement ends at handleVC logic.
        // I can replace from line 1 TO line 278 (end of handleTalk).
    }
}
// This is getting complicated to replace safely without deleting getDiscordMember.
// Let's redefine the replacement to cover lines 1 to 278, and I will manually recreate getDiscordMember/handleVC/handleStaffMove logic or reference them?
// No, I must provide the full content for the replaced range.
// The file content I saw previously:
// Lines 1-386.
// handleTalk ends at 278.
// handleVC starts at 323.
// handleStaffMove is at 126.
// Wait, the file structure I saw:
// constructor -> start -> stop -> fetchLogs -> processCommand -> handleTalk -> handleVC -> handleStaffMove -> ...
// No, handleStaffMove was inserted at 126 in my previous view? 
// Ah, looking at Step 2346 display:
// 126: async handleStaffMove(staffUser, targetUser, abbreviation) {
// 239: async handleTalk(robloxUser, message) {
// 323: async handleVC(robloxUser, abbreviation) {
// 363: processQueue() {
// This order is messy. 
// I will target line 1 to 120 (Command processing) and verify I call handleStaffMove correctly.
// Then I will target handleTalk (239-278) to replace it.
// Then I will delete processQueue (363-383).
// And remove imports (1-4).


start() {
    if (!this.apiKey) {
        console.error('❌ [ERLC Service] CRITICAL: ERLC_SERVER_KEY is missing in environment variables! Polling will NOT work.');
    } else {
        console.log(`✅ [ERLC Service] API Key detected (Ends with: ...${this.apiKey.slice(-4)}). Starting Polling...`);
    }
    console.log(`🚀 [ERLC Service] Filter Time: ${lastTimestamp}`);
    this.interval = setInterval(() => this.fetchLogs(), this.pollingRate);
}

stop() {
    if (this.interval) clearInterval(this.interval);
}

    async fetchLogs() {
    if (!this.apiKey) return;

    try {
        const response = await axios.get(this.apiUrl, {
            headers: { 'Server-Key': this.apiKey }
        });

        const logs = response.data;
        if (!logs || logs.length === 0) return;

        // Filtrar y ordenar
        // La API devuelve logs. Recorremos.
        // Estructura Real: { "Player": "user:123", "Command": ":cmd", "Timestamp": 123456 }

        // Ordenar por Timestamp ascendente (viejo -> nuevo) para procesar en orden
        logs.sort((a, b) => a.Timestamp - b.Timestamp);

        let newLogs = [];
        let debugLogCount = 0;

        for (const log of logs) {
            // Solo procesar logs NUEVOS (Timestamp > lastTimestamp)
            if (log.Timestamp > lastTimestamp) {
                newLogs.push(log);
            } else {
                // DEBUG: Loguear solo el primero ignorado para no spam
                if (debugLogCount === 0) {
                    // console.log(`[ERLC DEBUG] Ignored Old Log: ${log.Command} (${log.Timestamp} <= ${lastTimestamp})`);
                }
                debugLogCount++;
            }
        }

        if (newLogs.length > 0) {
            console.log(`[ERLC Service] Processing ${newLogs.length} new logs...`);
        }

        // Procesar nuevos
        for (const log of newLogs) {
            if (log.Command && log.Command.toLowerCase().startsWith(':log ')) {
                await this.processCommand(log);
            }
            // Actualizar timestamp
            if (log.Timestamp > lastTimestamp) {
                lastTimestamp = log.Timestamp;
            }
        }

    } catch (error) {
        console.error('[ERLC Service] Polling Error:', error.message);
    }
}

    async processCommand(log) {
    // Log Real: { Player: "vonssyb:2482237280", Command: ":log talk hola", Timestamp: ... }
    const content = log.Command;
    const rawPlayer = log.Player || "";

    // "vonssyb:2482237280" -> "vonssyb"
    const robloxUser = rawPlayer.split(':')[0];

    console.log(`[ERLC Service] 📥 Processing Command: User="${robloxUser}" Cmd="${content}" RawPlayer="${rawPlayer}"`);

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

    // ... (rest of methods)

    // Nuevo método para Staff Move
    async handleStaffMove(staffUser, targetUser, abbreviation) {
    // 1. Verificar si quien ejecuta (staffUser) es STAFF o JUNTA DIRECTIVA
    const staffMember = await this.getDiscordMember(staffUser);
    const staffRoleId = voiceConfig.ROLES.STAFF;
    const jdRoleId = voiceConfig.ROLES.JUNTA_DIRECTIVA;

    if (!staffMember) return;

    const isStaff = staffMember.roles.cache.has(staffRoleId);
    const isJD = staffMember.roles.cache.has(jdRoleId);

    if (!isStaff && !isJD) {
        console.log(`[ERLC Service] Denied Move: ${staffUser} is not Staff/JD`);
        return;
    }

    // 2. Obtener miembro objetivo
    const targetMember = await this.getDiscordMember(targetUser);
    if (!targetMember || !targetMember.voice.channelId) {
        console.log(`[ERLC Service] Move Failed: Target ${targetUser} not found or not in VC`);
        return;
    }

    // 3. Obtener canal destino
    const targetId = voiceConfig.getIdFromAlias(abbreviation);
    if (!targetId) return;

    // 4. Mover
    await targetMember.voice.setChannel(targetId).catch(console.error);
    const channelName = voiceConfig.CHANNELS[targetId]?.name || abbreviation;
    console.log(`[ERLC Service] Staff Move: ${staffUser} moved ${targetUser} to ${channelName}`);

    // Opcional: Feedback a Staff (si estuviera en un canal de voz, p.ej. sfx)
}

    async getDiscordMember(robloxUser) {
    // 1. Check Cache
    if (this.linkCache.has(robloxUser.toLowerCase())) {
        const id = this.linkCache.get(robloxUser.toLowerCase());
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
        return await guild.members.fetch(id).catch(() => null);
    }

    // 2. Check Auto Link (Citizens) or Manual Link
    let discordId = null;

    // Manual Link
    const { data: link } = await this.supabase
        .from('roblox_discord_links')
        .select('discord_user_id')
        .ilike('roblox_username', robloxUser) // Case insensitive
        .maybeSingle();

    if (link) discordId = link.discord_user_id;

    // Auto Link (Citizens)
    if (!discordId) {
        const { data: citizen } = await this.supabase
            .from('citizens')
            .select('discord_id')
            .ilike('roblox_username', robloxUser) // Case insensitive
            .maybeSingle();
        if (citizen) discordId = citizen.discord_id;
    }

    if (discordId) {
        this.linkCache.set(robloxUser.toLowerCase(), discordId);
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
        return await guild.members.fetch(discordId).catch(() => null);
    }

    // 3. Fallback: Search by Discord Username OR Nickname (Ignoring Tags)
    try {
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
        if (guild) {
            // Search via API (Handles both username and nickname)
            const results = await guild.members.search({ query: robloxUser, limit: 10 });

            // Helper to clean nickname (remove [Tag], 123 | , emojis)
            const cleanName = (name) => {
                return name
                    .replace(/\[.*?\]/g, '') // Remove [Tags]
                    .replace(/\(.*?\)/g, '') // Remove (Tags)
                    .replace(/^\d+\s*\|\s*/, '') // Remove "123 | " prefix
                    .replace(/\s*\|\s*.*$/, '') // Remove " | Suffix"
                    .trim()
                    .toLowerCase();
            };

            const target = robloxUser.toLowerCase();

            const member = results.find(m => {
                const username = m.user.username.toLowerCase();
                const nickname = cleanName(m.displayName);

                // console.log(`[ERLC Debug] Checking: ${m.user.tag} | Nick: "${m.displayName}" -> Clean: "${nickname}" vs Target: "${target}"`);

                return username === target || nickname === target;
            });

            if (member) {
                console.log(`[ERLC Service] 🔗 Auto-Linked via Fuzzy Match: ${robloxUser} -> ${member.user.tag} (Nick: ${member.displayName})`);
                this.linkCache.set(robloxUser.toLowerCase(), member.id);
                return member;
            }
        }
    } catch (e) {
        console.error('[ERLC Service] Username Fallback Error:', e.message);
    }

    return null;
}

    async handleTalk(robloxUser, message) {
    try {
        console.log(`[ERLC Service] 🗣️ Processing Talk Command: ${robloxUser} says "${message}"`);
        const member = await this.getDiscordMember(robloxUser);
        if (!member || !member.voice.channelId) {
            console.log(`[ERLC Service] Talk Ignored: User not in VC`);
            return;
        }

        const channelId = member.voice.channelId;
        const channelInfo = voiceConfig.getChannelInfo(channelId); // Whitelist check

        if (!channelInfo) {
            console.log(`[ERLC Service] Talk Ignored: Channel ${channelId} not in whitelist`);
            return;
        }

        // TTS Logic
        console.log(`[ERLC Service] Generating TTS Stream...`);
        const stream = discordTTS.getVoiceStream(`${robloxUser} dice: ${message}`, { lang: 'es' });

        console.log(`[ERLC Service] Creating Audio Resource...`);
        const resource = createAudioResource(stream);
        const guild = member.guild;

        console.log(`[ERLC Service] Joining Voice Channel ${channelId}...`);
        const connection = await this.ensureConnection(guild, channelId);

        if (!connection) {
            console.error('[ERLC Service] Failed to establish voice connection.');
            return;
        }

        console.log(`[ERLC Service] Enqueueing Audio...`);
        this.audioQueue.push({ connection, resource });
        this.processQueue();
    } catch (error) {
        console.error(`❌ [ERLC Service] HandleTalk Crash Prevention:`, error);
    }
}

    async ensureConnection(guild, channelId) {
    let connection = getVoiceConnection(guild.id);

    try {
        // If connection exists but is in bad state, destroy it
        if (connection) {
            const status = connection.state.status;
            if (status === 'disconnected' || status === 'destroyed') {
                console.log(`[ERLC Service] Connection in bad state (${status}). Recreating...`);
                connection.destroy();
                connection = null;
            } else if (connection.joinConfig.channelId !== channelId) {
                console.log(`[ERLC Service] Switching channels...`);
                // Just rejoin, joinVoiceChannel handles the switch
            }
        }

        if (!connection) {
            connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        // ATTACH ERROR HANDLERS (Vital for preventing crashes)
        if (connection.listenerCount('error') === 0) {
            connection.on('error', (error) => {
                console.warn(`⚠️ [ERLC Service] Connection Error (Ignored):`, error.message);
            });
        }

        // Re-verify it's not destroyed
        if (connection.state.status === 'destroyed') return null;

        return connection;

    } catch (e) {
        console.error('[ERLC Service] EnsureConnection Error:', e);
        return null;
    }
}

    async handleVC(robloxUser, abbreviation) {
    const member = await this.getDiscordMember(robloxUser);

    if (!member) {
        console.log(`[ERLC Service] Move Error: User ${robloxUser} not linked or not found in Discord`);
        return;
    }

    if (!member.voice.channelId) {
        console.log(`[ERLC Service] Move Error: User ${robloxUser} (Discord: ${member.user.tag}) is NOT in a voice channel.`);
        return;
    }

    const targetId = voiceConfig.getIdFromAlias(abbreviation);
    if (!targetId) {
        console.log(`[ERLC Service] Move Error: Alias '${abbreviation}' not found in config.`);
        return;
    }

    // VERIFICAR PERMISOS
    const channelInfo = voiceConfig.getChannelInfo(targetId);
    if (channelInfo && channelInfo.requiredRole) {
        const roleKey = channelInfo.requiredRole;
        const roleId = voiceConfig.ROLES[roleKey];

        if (roleId && !member.roles.cache.has(roleId)) {
            console.log(`[ERLC Service] Access Denied: ${robloxUser} tried to enter ${channelInfo.name} without role`);
            // Opcional: Mandar mensaje de error al usuario
            return;
        }
    }

    try {
        await member.voice.setChannel(targetId);
        console.log(`✅ [ERLC Service] SUCCESS: Moved ${robloxUser} to ${targetId} (${abbreviation})`);
    } catch (error) {
        console.error(`❌ [ERLC Service] Move Failed (Discord API Error):`, error.message);
    }
}

processQueue() {
    if (this.isPlaying || this.audioQueue.length === 0) return;
    this.isPlaying = true;

    const { connection, resource } = this.audioQueue.shift();
    const player = createAudioPlayer();

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
        this.isPlaying = false;
        this.processQueue();
    });

    player.on('error', () => {
        this.isPlaying = false;
        this.processQueue();
    });
}
}

module.exports = ErlcPollingService;
