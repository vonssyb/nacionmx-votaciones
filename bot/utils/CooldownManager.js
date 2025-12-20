/**
 * Cooldown Manager
 * Prevents command spam with configurable cooldowns
 */

class CooldownManager {
    constructor() {
        this.cooldowns = new Map(); // key: `${commandName}:${userId}`, value: timestamp
        this.config = new Map(); // key: commandName, value: cooldownMs

        // Default cooldowns (in milliseconds)
        this.setDefaultCooldowns();
    }

    /**
     * Set default cooldowns for commands
     */
    setDefaultCooldowns() {
        // Casino/gambling commands - prevent spam
        this.config.set('casino', 5000); // 5s
        this.config.set('slots', 3000); // 3s
        this.config.set('blackjack', 5000); // 5s
        this.config.set('crash', 10000); // 10s
        this.config.set('ruleta', 5000); // 5s

        // Money commands - prevent abuse
        this.config.set('debito', 2000); // 2s
        this.config.set('credito', 2000); // 2s
        this.config.set('transferir', 3000); // 3s

        // Admin commands - light cooldown
        this.config.set('empresa', 1000); // 1s
        this.config.set('nomina', 2000); // 2s

        // Info commands - no cooldown
        this.config.set('status', 0);
        this.config.set('ayuda', 0);
        this.config.set('balanza', 0);
    }

    /**
     * Check if command is on cooldown
     * @param {string} commandName - Command name
     * @param {string} userId - User ID
     * @param {boolean} isAdmin - If user is admin (bypasses cooldown)
     * @returns {object} { onCooldown: boolean, remaining: number }
     */
    check(commandName, userId, isAdmin = false) {
        // Admins bypass cooldowns
        if (isAdmin) {
            return { onCooldown: false, remaining: 0 };
        }

        const cooldownTime = this.config.get(commandName) || 0;
        if (cooldownTime === 0) {
            return { onCooldown: false, remaining: 0 };
        }

        const key = `${commandName}:${userId}`;
        const lastUsed = this.cooldowns.get(key);

        if (!lastUsed) {
            return { onCooldown: false, remaining: 0 };
        }

        const elapsed = Date.now() - lastUsed;
        const remaining = cooldownTime - elapsed;

        if (remaining > 0) {
            return { onCooldown: true, remaining };
        }

        return { onCooldown: false, remaining: 0 };
    }

    /**
     * Set cooldown for a command/user
     * @param {string} commandName 
     * @param {string} userId 
     */
    set(commandName, userId) {
        const key = `${commandName}:${userId}`;
        this.cooldowns.set(key, Date.now());
    }

    /**
     * Set custom cooldown time for a command
     * @param {string} commandName 
     * @param {number} ms - Cooldown in milliseconds
     */
    setCooldownTime(commandName, ms) {
        this.config.set(commandName, ms);
    }

    /**
     * Clear cooldown for a user/command
     * @param {string} commandName 
     * @param {string} userId 
     */
    clear(commandName, userId) {
        const key = `${commandName}:${userId}`;
        this.cooldowns.delete(key);
    }

    /**
     * Clear all cooldowns (useful for testing)
     */
    clearAll() {
        this.cooldowns.clear();
    }

    /**
     * Cleanup old cooldowns (call periodically)
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, timestamp] of this.cooldowns.entries()) {
            // If cooldown is older than 5 minutes, remove it
            if (now - timestamp > 300000) {
                this.cooldowns.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }
}

module.exports = CooldownManager;
