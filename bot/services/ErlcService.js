/**
 * ErlcService - Integration with Emergency Response: Liberty County API
 */

class ErlcService {
    constructor(apiKey, apiUrl = 'https://api.policeroleplay.community/v1') {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }

    /**
     * Get Server Info (Status, Players, etc.)
     */
    async getServerInfo() {
        try {
            // 1. Get Server Status
            const response = await fetch(`${this.apiUrl}/server`, {
                headers: { 'Server-Key': this.apiKey }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('[ErlcService] Rate Limited');
                    return null;
                }
                // Suppress expected API errors
                if ([403, 500, 502, 503, 504].includes(response.status)) {
                    console.warn(`[ErlcService] API Unavailable (${response.status}): ${response.statusText}`);
                    return null;
                }
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // 2. Get Players
            const pResponse = await fetch(`${this.apiUrl}/server/players`, {
                headers: { 'Server-Key': this.apiKey }
            });

            if (pResponse.ok) {
                const playersRaw = await pResponse.json();

                // Parse "Player: Name:ID" format
                data.Players = playersRaw.map(p => {
                    let name = p.Player;
                    let id = 0;

                    if (p.Player && p.Player.includes(':')) {
                        const parts = p.Player.split(':');
                        id = parts.pop(); // Last part is ID
                        name = parts.join(':'); // Rest is Name
                    }

                    return {
                        ...p,
                        Player: name,
                        Id: id
                    };
                });
            } else {
                data.Players = [];
            }

            return data;
        } catch (error) {
            console.error('[ErlcService] Error fetching server info:', error.message);
            return null;
        }
    }

    /**
     * Get Server Vehicles (Emergency only usually)
     */
    async getVehicles() {
        try {
            const response = await fetch(`${this.apiUrl}/server/vehicles`, {
                headers: { 'Server-Key': this.apiKey }
            });

            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            // Suppress common errors
            if (error.message.includes('502') || error.message.includes('403')) {
                console.warn('[ErlcService] Failed to fetch vehicles (API Error)');
            } else {
                console.error('[ErlcService] Error fetching vehicles:', error.message);
            }
            return [];
        }
    }

    /**
     * Remote Command (Kick/Ban/Announce)
     * Now uses a prioritized queue to prevent rate limits and ensure speed.
     * @param {string} command - The command to run
     * @param {boolean} priority - Whether this command should skip to the front (e.g. for announcements)
     */
    async runCommand(command, priority = false) {
        if (!this.commandQueue) {
            this.commandQueue = [];
            this.isProcessingQueue = false;
        }

        return new Promise((resolve) => {
            const task = { command, resolve, attempts: 0, priority };
            if (priority) {
                // Add to the front of the queue (after currently processing if any)
                this.commandQueue.unshift(task);
            } else {
                this.commandQueue.push(task);
            }
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.isProcessingQueue || this.commandQueue.length === 0) return;
        this.isProcessingQueue = true;

        try {
            while (this.commandQueue.length > 0) {
                const task = this.commandQueue.shift();

                console.log(`🚀 [ErlcService] Processing ${task.priority ? 'PRIORITY ' : ''}command: ${task.command}`);
                const success = await this._executeRawCommand(task.command);

                if (!success && task.attempts < 3) {
                    console.warn(`[ErlcService] Command failed, re-queueing (Attempt ${task.attempts + 1}): ${task.command}`);
                    task.attempts++;
                    // Re-queue with priority if it was already priority
                    if (task.priority) {
                        this.commandQueue.unshift(task);
                    } else {
                        this.commandQueue.push(task);
                    }
                } else if (success) {
                    console.log(`✅ [ErlcService] Command SUCCESS: ${task.command}`);
                    task.resolve(true);
                } else {
                    task.resolve(false);
                }

                // Forced delay between commands to respect rate limits (2.5 seconds for absolute safety)
                if (this.commandQueue.length > 0) {
                    await new Promise(r => setTimeout(r, 2500));
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async _executeRawCommand(command) {
        try {
            const response = await fetch(`${this.apiUrl}/server/command`, {
                method: 'POST',
                headers: {
                    'Server-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('[ErlcService] Rate Limited during command execution');
                    return false;
                }
                const err = await response.json().catch(() => ({ message: 'Unknown Error' }));
                throw new Error(err.message || 'Unknown Error');
            }
            return true;
        } catch (error) {
            console.error('[ErlcService] Raw Command Error:', error.message);
            return false;
        }
    }

    /**
     * Get Log Data (Generic)
     */
    async _getLogs(endpoint) {
        try {
            const response = await fetch(`${this.apiUrl}/server/${endpoint}`, {
                headers: { 'Server-Key': this.apiKey }
            });
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error(`[ErlcService] Error fetching ${endpoint}:`, error.message);
            return [];
        }
    }

    async getKillLogs() { return this._getLogs('killlogs'); }
    async getCommandLogs() { return this._getLogs('commandlogs'); }
    async getJoinLogs() { return this._getLogs('joinlogs'); }
}

module.exports = ErlcService;
