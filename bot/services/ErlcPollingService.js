const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const discordTTS = require('discord-tts');

// Mapeo simple para evitar duplicados. Guardaremos Timestamp del último log procesado.
// Start looking 60 seconds back to catch commands sent during restart/boot
let lastTimestamp = Math.floor(Date.now() / 1000) - 60;

class ErlcPollingService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.apiKey = process.env.ERLC_SERVER_KEY;
        this.apiUrl = 'https://api.policeroleplay.community/v1/server/commandlogs';
        this.interval = null;
        this.pollingRate = 5000; // 5 segundos

        // Cache simple para vinculaciones links
        this.linkCache = new Map();

        // TTS Queue
        this.audioQueue = [];
        this.isPlaying = false;
    }

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
            let connection = getVoiceConnection(guild.id);
            if (!connection || connection.joinConfig.channelId !== channelId) {
                connection = joinVoiceChannel({
                    channelId: channelId,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
            }

            console.log(`[ERLC Service] Enqueueing Audio...`);
            this.audioQueue.push({ connection, resource });
            this.processQueue();
        } catch (error) {
            console.error(`❌ [ERLC Service] HandleTalk Crash Prevention:`, error);
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
