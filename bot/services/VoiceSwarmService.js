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
        this.workers.sort((a, b) => (a.index || 0) - (b.index || 0));
        console.log(`🐝 [VoiceSwarm] Swarm ready with ${this.workers.length} active drones.`);
        this.initialized = true;
    }

    /**
     * Manually register an external client as a worker
     */
    registerClient(client, name = 'External') {
        if (this.workers.some(w => w.id === client.user.id)) return;

        console.log(`🐝 [VoiceSwarm] Registering external worker: ${client.user.tag} (${name})`);
        this.workers.push({
            client: client,
            id: client.user.id,
            tag: client.user.tag,
            index: this.workers.length + 100, // Offset for external
            busy: false
        });
    }

    /**
     * Waits until a worker is free or a worker in the specific channel is found.
     */
    async waitForWorker(guildId, channelId) {
        return new Promise((resolve) => {
            const check = () => {
                // 1. Find a worker already in this channel who is NOT busy
                let worker = this.findWorkerInChannel(guildId, channelId);
                if (worker && !worker.busy) {
                    worker.busy = true; // ATOMIC RESERVE
                    return resolve(worker);
                }

                // 2. Find ANY free worker (even if they have to move channels)
                worker = this.getFreeWorker();
                if (worker) {
                    worker.busy = true; // ATOMIC RESERVE
                    return resolve(worker);
                }

                // 3. If nobody is free, wait 100ms and try again (Queueing)
                setTimeout(check, 100);
            };
            check();
        });
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

        // Wait for an available worker to avoid interrupting other broadcasts
        const worker = await this.waitForWorker(guildId, channelId);

        console.log(`🐝 [VoiceSwarm] Dispatched to ${worker.tag} -> Channel ${channelId}`);
        // Note: busy is already true from waitForWorker
        await this.executeVoiceTask(worker, guildId, channelId, text, true); // true = alreadyBusy
    }

    async dispatchAudioFile(channelId, audioFilePath, guildId = process.env.GUILD_ID || '1398525215134318713') {
        // Same worker selection logic as TTS
        let worker = this.findWorkerInChannel(guildId, channelId);
        if (!worker) {
            worker = this.getFreeWorker();
        }
        if (!worker) {
            worker = this.workers[Math.floor(Math.random() * this.workers.length)];
        }

        console.log(`🐝 [VoiceSwarm] Dispatching audio file to ${worker.tag} -> Channel ${channelId}`);
        await this.executeAudioFileTask(worker, guildId, channelId, audioFilePath);
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

    async executeVoiceTask(worker, guildId, channelId, text, alreadyBusy = false) {
        if (!alreadyBusy) worker.busy = true;
        try {
            console.log(`🐝 [VoiceSwarm] [${worker.tag}] Fetching guild...`);
            const guild = await worker.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                console.error(`[VoiceSwarm] [${worker.tag}] Cannot find guild ${guildId}`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] [${worker.tag}] Connecting to channel ${channelId}...`);
            // Connection Logic (Robust)
            const connection = await this.ensureConnection(worker, guild, channelId);
            if (!connection) {
                console.error(`🐝 [VoiceSwarm] [${worker.tag}] Connection failed`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] [${worker.tag}] Generating TTS: "${text}"`);
            // Generate TTS using discord-tts (more reliable than google-tts-api)
            const discordTTS = require('discord-tts');
            const stream = discordTTS.getVoiceStream(text, { lang: 'es' });
            const resource = createAudioResource(stream);
            const player = createAudioPlayer();

            console.log(`🐝 [VoiceSwarm] [${worker.tag}] Subscribing player...`);
            // Subscribe
            const subscription = connection.subscribe(player);
            if (!subscription) {
                console.error(`🐝 [VoiceSwarm] [${worker.tag}] Failed to subscribe player`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] [${worker.tag}] Playing audio...`);
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
                // Safety timeout 30s (increased from 10s for slow networks)
                setTimeout(() => {
                    console.warn(`🐝 [VoiceSwarm] ${worker.tag} - Timeout (30s)`);
                    resolve();
                }, 30000);
            });

        } catch (error) {
            console.error(`[VoiceSwarm] Error executing task on ${worker.tag}:`, error);
        } finally {
            worker.busy = false;
        }
    }

    async executeAudioFileTask(worker, guildId, channelId, audioFilePath) {
        worker.busy = true;
        try {
            const fs = require('fs');
            const { createAudioResource, StreamType } = require('@discordjs/voice');

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Fetching guild...`);
            const guild = await worker.client.guilds.fetch(guildId).catch(() => null);
            if (!guild) {
                console.error(`[VoiceSwarm] Worker ${worker.tag} cannot find guild ${guildId}`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Connecting to channel ${channelId}...`);
            const connection = await this.ensureConnection(worker, guild, channelId);
            if (!connection) {
                console.error(`🐝 [VoiceSwarm] ${worker.tag} - Connection failed`);
                return;
            }

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Creating audio resource from file: ${audioFilePath}`);
            const audioResource = createAudioResource(fs.createReadStream(audioFilePath), {
                inputType: StreamType.Arbitrary
            });

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Subscribing player to connection...`);
            const player = createAudioPlayer();
            connection.subscribe(player);

            console.log(`🐝 [VoiceSwarm] ${worker.tag} - Playing audio file...`);
            player.play(audioResource);

            // Wait for audio to finish
            await new Promise((resolve) => {
                player.on(AudioPlayerStatus.Idle, () => {
                    console.log(`🐝 [VoiceSwarm] ✅ ${worker.tag} - Finished playing audio file`);
                    resolve();
                });
                player.on('error', (err) => {
                    console.error(`[VoiceSwarm] Audio player error on ${worker.tag}:`, err.message);
                    resolve();
                });
                // Safety timeout 10s for audio file
                setTimeout(() => {
                    console.warn(`🐝 [VoiceSwarm] ${worker.tag} - Audio playback timeout (10s)`);
                    resolve();
                }, 10000);
            });

        } catch (error) {
            console.error(`[VoiceSwarm] Error executing audio task on ${worker.tag}:`, error);
        } finally {
            worker.busy = false;
        }
    }

    async ensureConnection(worker, guild, channelId) {
        const group = worker.id;
        let connection = getVoiceConnection(guild.id, group);

        try {
            if (connection) {
                const status = connection.state.status;
                const currentChannelId = connection.joinConfig.channelId;

                // IMPORTANT: If already connected but to a DIFFERENT channel, move!
                if (currentChannelId !== channelId) {
                    console.log(`🐝 [VoiceSwarm] ${worker.tag} - Moving from ${currentChannelId} to ${channelId}`);
                    connection = joinVoiceChannel({
                        channelId: channelId,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                        group: group
                    });
                } else if (status === 'destroyed' || status === 'disconnected') {
                    console.log(`🐝 [VoiceSwarm] ${worker.tag} - Connection in bad state (${status}), recreating...`);
                    connection.destroy();
                    connection = null;
                }
            }

            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channelId,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    group: group
                });

                // Handle connection errors and auto-reconnect
                connection.on('error', (error) => {
                    console.warn(`⚠️ [VoiceSwarm] Connection Error on ${worker.tag}:`, error.message);
                    if (error.message.includes('socket closed')) {
                        console.log(`🐝 [VoiceSwarm] ${worker.tag} - Attempting reconnect...`);
                        setTimeout(() => {
                            connection.destroy();
                            // Next call will recreate
                        }, 1000);
                    }
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
