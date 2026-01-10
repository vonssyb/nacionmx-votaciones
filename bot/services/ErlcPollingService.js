const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const discordTTS = require('discord-tts');

// Mapeo simple para evitar duplicados. Guardaremos Timestamp del último log procesado.
let lastTimestamp = Math.floor(Date.now() / 1000); // Iniciar ignorando logs viejos al arrancar

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
        console.log('🚀 [ERLC Service] Starting Command Log Polling...');
        // No fetchLogs user immediately to avoid processing old logs if logic isn't perfect
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

            for (const log of logs) {
                // Solo procesar logs NUEVOS (Timestamp > lastTimestamp)
                if (log.Timestamp > lastTimestamp) {
                    newLogs.push(log);
                }
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

        console.log(`[ERLC Service] New Command: ${robloxUser} -> ${content}`);

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
        // 1. Verificar si quien ejecuta (staffUser) es STAFF
        const staffMember = await this.getDiscordMember(staffUser);
        const staffRoleId = voiceConfig.ROLES.STAFF; // Asegúrate de tener esto en config

        if (!staffMember || !staffMember.roles.cache.has(staffRoleId)) {
            console.log(`[ERLC Service] Denied Move: ${staffUser} is not Staff`);
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
        if (this.linkCache.has(robloxUser)) {
            const id = this.linkCache.get(robloxUser);
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            return await guild.members.fetch(id).catch(() => null);
        }

        // 2. Check Auto Link (Citizens) or Manual Link
        let discordId = null;

        // Manual Link
        const { data: link } = await this.supabase
            .from('roblox_discord_links')
            .select('discord_user_id')
            .eq('roblox_username', robloxUser)
            .maybeSingle();

        if (link) discordId = link.discord_user_id;

        // Auto Link (Citizens)
        if (!discordId) {
            const { data: citizen } = await this.supabase
                .from('citizens')
                .select('discord_id')
                .eq('roblox_username', robloxUser)
                .maybeSingle();
            if (citizen) discordId = citizen.discord_id;
        }

        if (discordId) {
            this.linkCache.set(robloxUser, discordId);
            const guild = this.client.guilds.cache.get(process.env.GUILD_ID || '1398525215134318713');
            return await guild.members.fetch(discordId).catch(() => null);
        }

        return null;
    }

    async handleTalk(robloxUser, message) {
        const member = await this.getDiscordMember(robloxUser);
        if (!member || !member.voice.channelId) return;

        const channelId = member.voice.channelId;
        const channelInfo = voiceConfig.getChannelInfo(channelId); // Whitelist check

        if (!channelInfo) return;

        // TTS Logic
        const stream = discordTTS.getVoiceStream(`${robloxUser} dice: ${message}`, { lang: 'es' });
        const resource = createAudioResource(stream);
        const guild = member.guild;

        let connection = getVoiceConnection(guild.id);
        if (!connection || connection.joinConfig.channelId !== channelId) {
            connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
        }

        this.audioQueue.push({ connection, resource });
        this.processQueue();
    }

    async handleVC(robloxUser, abbreviation) {
        const member = await this.getDiscordMember(robloxUser);
        if (!member || !member.voice.channelId) return; // Must be in VC to move

        const targetId = voiceConfig.getIdFromAlias(abbreviation);
        if (!targetId) return;

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

        await member.voice.setChannel(targetId).catch(console.error);
        console.log(`[ERLC Service] Moved ${robloxUser} to ${abbreviation}`);
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
