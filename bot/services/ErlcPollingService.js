const axios = require('axios');
const voiceConfig = require('../config/erlcVoiceChannels');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const discordTTS = require('discord-tts');

// Mapeo simple para evitar duplicados. Guardaremos ID del último log procesado.
let lastLogId = null;

class ErlcPollingService {
    constructor(client, supabase) {
        this.client = client;
        this.supabase = supabase;
        this.apiKey = process.env.ERLC_SERVER_KEY;
        this.apiUrl = 'https://api.policeroleplay.community/v1/server/commandlogs';
        this.interval = null;
        this.pollingRate = 5000; // 5 segundos

        // Cache simple para vinculaciones
        this.linkCache = new Map();

        // TTS Queue
        this.audioQueue = [];
        this.isPlaying = false;
    }

    start() {
        console.log('🚀 [ERLC Service] Starting Command Log Polling...');
        this.fetchLogs(); // Primera ejecución inmediata
        this.interval = setInterval(() => this.fetchLogs(), this.pollingRate);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async fetchLogs() {
        if (!this.apiKey) {
            console.error('[ERLC Service] API Key missing!');
            return;
        }

        try {
            const response = await axios.get(this.apiUrl, {
                headers: { 'Server-Key': this.apiKey }
            });

            // La API devuelve un array de logs
            // Estructura probable: [{ id, command, player, timestamp }, ...]
            // Nota: La doc oficial puede variar, ajustaremos según respuesta real si falla.
            const logs = response.data;

            if (!logs || logs.length === 0) return;

            // Ordenar por fecha (más reciente al final)
            // Asumimos que la API los devuelve ordenados o tienen timestamp

            // Filtrar solo comandos relevantes (:log)
            const relevantLogs = logs.filter(log => log.command && log.command.toLowerCase().startsWith(':log '));

            // Procesar solo nuevos logs
            // Si es la primera vez (lastLogId null), tomamos solo el último para inicializar
            if (lastLogId === null) {
                if (relevantLogs.length > 0) {
                    lastLogId = relevantLogs[0].id; // Asumimos ID numérico o único
                    console.log(`[ERLC Service] Initialized with Log ID: ${lastLogId}`);
                }
                return;
            }

            // Procesar logs que tengan ID mayor al último procesado
            // Nota: Si la API no da IDs incrementales, tendríamos que usar timestamp + contenido
            // Para simplificar, procesaremos los que sean "nuevos" en la lista devuelta
            // Pero como es polling, necesitamos un marcador.
            // Asumiremos que la API devuelve los más recientes.

            // ERLC API suele devolver data reciente.
            // Vamos a iterar y ver cuáles son nuevos comparando con lastLogId

            let newLogs = [];
            for (const log of relevantLogs) {
                // Si encontramos el último log procesado, paramos de buscar hacia atrás
                // O mejor: Filtramos los que sean > lastLogId si es numérico.
                // Si lastLogId es string, puede ser complicado. 
                // Usaremos lógica simple: Ignorar si log.id <= lastLogId (si es numérico)
                if (log.id > lastLogId) {
                    newLogs.push(log);
                }
            }

            // Actualizar lastLogId con el más reciente de los nuevos
            if (newLogs.length > 0) {
                lastLogId = newLogs[0].id; // Asumiendo que el índice 0 es el más reciente en la respuesta típica

                // Procesar (invertir orden para cronológico si es necesario)
                for (const log of newLogs.reverse()) {
                    await this.processCommand(log);
                }
            }

        } catch (error) {
            console.error('[ERLC Service] Polling Error:', error.message);
        }
    }

    async processCommand(log) {
        // log structure: { id, command, player: "Username", timestamp } (Hypothetical)
        const content = log.command; // ":log talk hola"
        const robloxUser = log.player;

        console.log(`[ERLC Service] New Command: ${robloxUser} -> ${content}`);

        if (content.toLowerCase().startsWith(':log talk ')) {
            const message = content.substring(10).trim();
            await this.handleTalk(robloxUser, message);
        } else if (content.toLowerCase().startsWith(':log vc ')) {
            const abr = content.substring(8).trim();
            await this.handleVC(robloxUser, abr);
        }
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
