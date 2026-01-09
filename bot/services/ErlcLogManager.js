const { EmbedBuilder } = require('discord.js');


class ErlcLogManager {
    constructor(client, supabase, erlcService, logChannelId) {
        this.client = client;
        this.supabase = supabase;
        this.erlcService = erlcService;
        this.logChannelId = logChannelId;
        this.isRunning = false;
        this.currentInterval = 60000; // Default 1 min
        this.timer = null;
        this.stateLoaded = false;

        // Log State
        this.state = {
            lastKill: 0,
            lastCommand: 0,
            lastJoin: 0,
            processedKills: new Set(),
            processedCommands: new Set(),
            processedJoins: new Set()
        };
    }

    async loadState() {
        try {
            const { data, error } = await this.supabase
                .from('erlc_log_state')
                .select('state_data')
                .eq('id', 1)
                .single();

            if (data && data.state_data) {
                const saved = data.state_data;
                this.state.lastKill = saved.lastKill || 0;
                this.state.lastCommand = saved.lastCommand || 0;
                this.state.lastJoin = saved.lastJoin || 0;
                // Sets are reconstructed from arrays
                this.state.processedKills = new Set(saved.processedKills || []);
                this.state.processedCommands = new Set(saved.processedCommands || []);
                this.state.processedJoins = new Set(saved.processedJoins || []);
                console.log(`[ErlcLogManager] State restored from Supabase. Last Kill: ${this.state.lastKill}`);
            } else {
                console.log('[ErlcLogManager] No saved state found in DB. Starting fresh (0).');
            }
        } catch (e) {
            console.error('[ErlcLogManager] Failed to load state:', e);
        } finally {
            this.stateLoaded = true;
        }
    }

    async saveState() {
        try {
            // Check if state is loaded to avoid overwriting DB with empty state on race condition
            if (!this.stateLoaded) return;

            const payload = {
                lastKill: this.state.lastKill,
                lastCommand: this.state.lastCommand,
                lastJoin: this.state.lastJoin,
                processedKills: Array.from(this.state.processedKills),
                processedCommands: Array.from(this.state.processedCommands),
                processedJoins: Array.from(this.state.processedJoins)
            };

            const { error } = await this.supabase
                .from('erlc_log_state')
                .upsert({ id: 1, state_data: payload });

            if (error) console.error('[ErlcLogManager] DB Save Error:', error.message);
        } catch (e) {
            console.error('[ErlcLogManager] Failed to save state:', e);
        }
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Ensure state is loaded BEFORE polling
        console.log('[ErlcLogManager] Loading state...');
        await this.loadState();

        console.log(`[ErlcLogManager] Started. Initial polling every ${this.currentInterval / 1000}s`);
        this.scheduleNextPoll();
    }

    scheduleNextPoll() {
        if (!this.isRunning) return;
        this.timer = setTimeout(async () => {
            await this.poll();
            this.scheduleNextPoll();
        }, this.currentInterval);
    }

    async poll() {
        try {
            // Check Server Status to determine frequency
            const serverInfo = await this.erlcService.getServerInfo();
            const players = serverInfo?.CurrentPlayers || 0;

            // ADAPTIVE POLLING LOGIC
            // If players > 0 (Active) -> High Frequency (1 min)
            // If players == 0 (Empty/Offline) -> Low Frequency (50 min)

            let newInterval = 60000; // 1 Minute
            if (players === 0) {
                newInterval = 50 * 60 * 1000; // 50 Minutes
            }

            if (newInterval !== this.currentInterval) {
                console.log(`[ErlcLogManager] Polling interval adjusted: ${this.currentInterval / 1000}s -> ${newInterval / 1000}s (Players: ${players})`);
                this.currentInterval = newInterval;
            }

            // Only poll logs if the server is reachable (detected by serverInfo) or if we want to try anyway (but if empty, logs don't change much)
            // Actually, we should check logs if we are in the 'polling' cycle. 
            // The adaptive interval controls how OFTEN we check.

            const logChannel = await this.client.channels.fetch(this.logChannelId).catch(() => null);
            if (!logChannel) {
                console.warn(`[ErlcLogManager] Log channel ${this.logChannelId} not found.`);
                return;
            }

            // 1. Kill Logs
            const kills = await this.erlcService.getKillLogs();
            if (kills && kills.length > 0) {
                const newKills = kills.filter(k => k.Timestamp > this.state.lastKill).sort((a, b) => a.Timestamp - b.Timestamp);
                for (const [index, k] of newKills.entries()) {
                    const logId = `${k.Timestamp}_${k.Killer}_${k.Killed}_${index}`;
                    if (this.state.processedKills.has(logId)) continue;

                    const embed = new EmbedBuilder()
                        .setTitle('☠️ Kill Log')
                        .setColor(0x8B0000)
                        .setDescription(`**${k.Killer}** mató a **${k.Killed}**`)
                        .setTimestamp(k.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });

                    this.state.processedKills.add(logId);
                    this.state.lastKill = Math.max(this.state.lastKill, k.Timestamp);
                }
                this.cleanupSet(this.state.processedKills);
            }

            // 2. Command Logs
            const cmds = await this.erlcService.getCommandLogs();
            if (cmds && cmds.length > 0) {
                const newCmds = cmds.filter(c => c.Timestamp > this.state.lastCommand).sort((a, b) => a.Timestamp - b.Timestamp);
                for (const [index, c] of newCmds.entries()) {
                    const logId = `${c.Timestamp}_${c.Player}_${c.Command}_${index}`;
                    if (this.state.processedCommands.has(logId)) continue;

                    const embed = new EmbedBuilder()
                        .setTitle('⌨️ Command Log')
                        .setColor(0x00AAFF)
                        .setDescription(`**${c.Player}** usó \`${c.Command}\``)
                        .setTimestamp(c.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });

                    this.state.processedCommands.add(logId);
                    this.state.lastCommand = Math.max(this.state.lastCommand, c.Timestamp);
                }
                this.cleanupSet(this.state.processedCommands);
            }

            // 3. Join Logs
            const joins = await this.erlcService.getJoinLogs();
            if (joins && joins.length > 0) {
                const newJoins = joins.filter(j => j.Timestamp > this.state.lastJoin).sort((a, b) => a.Timestamp - b.Timestamp);
                for (const [index, j] of newJoins.entries()) {
                    const logId = `${j.Timestamp}_${j.Player}_${j.Join ? 'join' : 'leave'}_${index}`;
                    if (this.state.processedJoins.has(logId)) continue;

                    const embed = new EmbedBuilder()
                        .setTitle(j.Join ? '🟢 Entrada al Servidor' : '🔴 Salida del Servidor')
                        .setColor(j.Join ? 0x00FF00 : 0xFF0000)
                        .setDescription(`**${j.Player}**`)
                        .setTimestamp(j.Timestamp * 1000);
                    await logChannel.send({ embeds: [embed] });

                    this.state.processedJoins.add(logId);
                    this.state.lastJoin = Math.max(this.state.lastJoin, j.Timestamp);
                }
                this.cleanupSet(this.state.processedJoins);
            }

            this.saveState();

        } catch (error) {
            console.error('[ErlcLogManager] Error in poll:', error.message);
        }
    }

    cleanupSet(set) {
        if (set.size > 500) {
            const entries = Array.from(set);
            // Keep last 400
            for (let i = 0; i < entries.length - 400; i++) {
                set.delete(entries[i]);
            }
        }
    }
}

module.exports = ErlcLogManager;
