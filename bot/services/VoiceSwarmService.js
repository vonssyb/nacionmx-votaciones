const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');

class VoiceSwarmService {
    constructor(tokens) {
        this.tokens = tokens || [];
        this.workers = []; // { client: Client, id: string, tag: string, busy: boolean }
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        console.log(`🐝 [VoiceSwarm] Initializing ${this.tokens.length} workers...`);

        const promises = this.tokens.map((token, index) => {
            return new Promise((resolve) => {
                const client = new Client({
                    intents: [
                        GatewayIntentBits.Guilds,
                        GatewayIntentBits.GuildVoiceStates
                    ]
                });

                client.once('ready', () => {
                    console.log(`🐝 [VoiceSwarm] Worker ${index + 1} ready: ${client.user.tag}`);
                    this.workers.push({
                        client: client,
                        id: client.user.id,
                        tag: client.user.tag,
                        index: index,
                        busy: false
                    });
                    resolve();
                });

                client.on('error', (err) => {
                    console.error(`🐝 [VoiceSwarm] Worker ${index + 1} error:`, err.message);
                });

                client.login(token).catch(err => {
                    console.error(`🐝 [VoiceSwarm] Worker ${index + 1} failed login:`, err.message);
                    resolve(); // Resolve anyway so we don't block
                });
            });
        });

        await Promise.all(promises);
        // Sort by index to maintain consistency
        this.workers.sort((a, b) => a.index - b.index);
        console.log(`🐝 [VoiceSwarm] Swarm ready with ${this.workers.length} active drones.`);
        this.initialized = true;
    }

    /**
     * Dispatch a TTS message to an available worker
     * @param {string} guildId 
     * @param {string} channelId 
     * @param {string} text 
     */
    async speak(guildId, channelId, text) {
        if (this.workers.length === 0) {
            console.warn('[VoiceSwarm] No workers available!');
            return;
        }

        // 1. Find a worker already in this channel (Priority 1)
        let worker = this.findWorkerInChannel(guildId, channelId);

        // 2. If none, find a free worker (Priority 2)
        if (!worker) {
            worker = this.getFreeWorker();
        }

        // 3. Last resort: Pick random to share load (Wait... better to pick least busy? For now Random)
        if (!worker) {
            worker = this.workers[Math.floor(Math.random() * this.workers.length)];
        }

        console.log(`🐝 [VoiceSwarm] Dispatching task to ${worker.tag} -> Channel ${channelId}`);
        await this.executeVoiceTask(worker, guildId, channelId, text);
    }

    findWorkerInChannel(guildId, channelId) {
        for (const worker of this.workers) {
            const guild = worker.client.guilds.cache.get(guildId);
            if (!guild) continue;

            // Check discord.js voice state cache
            const voiceState = guild.members.me?.voice;
            if (voiceState && voiceState.channelId === channelId) {
                return worker;
            }
        }
        return null;
    }

    getFreeWorker() {
        return this.workers.find(w => !w.busy);
    }

    async executeVoiceTask(worker, guildId, channelId, text) {
        worker.busy = true;
        try {
            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Fetching guild...`);
            const guild = await worker.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                console.error(`[VoiceSwarm] Worker ${worker.tag} cannot find guild ${guildId}`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Connecting to channel ${channelId}...`);
            // Connection Logic (Robust)
            const connection = await this.ensureConnection(worker, guild, channelId);
            if (!connection) {
                console.error(`🐝 [VoiceSwarm] ${worker.tag} - Connection failed`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Generating TTS for: "${text}"`);
            // Generate TTS using discord-tts (more reliable than google-tts-api)
            const discordTTS = require('discord-tts');
            const stream = discordTTS.getVoiceStream(text, { lang: 'es' });
            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Subscribing player to connection...`);
            // Subscribe
            const subscription = connection.subscribe(player);
            if (!subscription) {
                console.error(`🐝 [VoiceSwarm] ${worker.tag} - Failed to subscribe player`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Playing audio...`);
            player.play(resource);

            // Wait for finish
            await new Promise((resolve) => {
                player.on(AudioPlayerStatus.Idle, () => {
                    console.log(`🐝 [VoiceSwarm] ✅ ${worker.tag} - Finished playing`);
                    resolve();
                });
                player.on('error', (err) => {
                    console.error(`[VoiceSwarm] Player error on ${worker.tag}:`, err.message);
                    resolve();
                });
                // Safety timeout 10s
                setTimeout(() => {
                    console.warn(`🐝 [VoiceSwarm] ${worker.tag} - Timeout (10s)`);
                    resolve();
                }, 10000);
            });

        } catch (error) {
            console.error(`[VoiceSwarm] Error executing task on ${worker.tag}:`, error);
        } finally {
            worker.busy = false;
        }
    }

    async ensureConnection(worker, guild, channelId) {
        // NOTE: getVoiceConnection is global for the process, BUT it is keyed by guildId.
        // With multiple clients in same process/guild, @discordjs/voice might get confused?
        // Actually @discordjs/voice supports 'group' parameter in joinVoiceChannel to distinguish clients.
        // Let's use the worker ID as the group identifier!

        const group = worker.id;

        let connection = getVoiceConnection(guild.id, group);

        try {
            if (connection) {
                if (connection.state.status === 'destroyed') {
                    connection = null;
                } else if (connection.joinConfig.channelId !== channelId) {
                    // connection.destroy(); // Destroy old if moving channels? Or let joinVoiceChannel handle it?
                    // Better to let join handle switch, but for Swarm, clean switching is better
                }
            }

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channelId,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    group: group // CRITICAL for multiple bots in same guild
                });

                // Attach error handler
                connection.on('error', (error) => {
                    console.warn(`⚠️ [VoiceSwarm] Connection Error on ${worker.tag}:`, error.message);
                });
            }

            return connection;
        } catch (error) {
            console.error(`[VoiceSwarm] Connection failed for ${worker.tag}:`, error);
            return null;
        }
    }
}

module.exports = VoiceSwarmService;
