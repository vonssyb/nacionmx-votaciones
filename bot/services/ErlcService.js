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
            console.error('[ErlcService] Error fetching vehicles:', error.message);
            return [];
        }
    }

    /**
     * Remote Command (Kick/Ban/Announce)
     */
    async runCommand(command) {
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
                const err = await response.json();
                throw new Error(err.message || 'Unknown Error');
            }
            return true;
        } catch (error) {
            console.error('[ErlcService] Command Error:', error.message);
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
