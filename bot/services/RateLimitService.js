/**
 * RateLimitService
 * Centralized rate limiting and cooldown management
 * 
 * Usage:
 *   const check = rateLimitService.checkCooldown(userId, 'empresa_transferir', 30000);
 *   if (!check.allowed) {
 *       return interaction.reply(`⏳ Espera ${check.remaining}s`);
 *   }
 */

class RateLimitService {
    constructor() {
        // Map structure: "userId_commandName" => timestamp
        this.cooldowns = new Map();
    }

    /**
     * Check if user can execute command
     * @param {string} userId - Discord user ID
     * @param {string} commandName - Command identifier (e.g., 'empresa_transferir')
     * @param {number} cooldownMs - Cooldown duration in milliseconds
     * @returns {{allowed: boolean, remaining?: number}} - allowed: whether action is permitted, remaining: seconds left in cooldown
     */
    checkCooldown(userId, commandName, cooldownMs) {
        const key = `${userId}_${commandName}`;
        const lastUsed = this.cooldowns.get(key);

        if (lastUsed) {
            const elapsed = Date.now() - lastUsed;
            if (elapsed < cooldownMs) {
                const remainingMs = cooldownMs - elapsed;
                return {
                    allowed: false,
                    remaining: Math.ceil(remainingMs / 1000) // Convert to seconds
                };
            }
        }

        // Update timestamp
        this.cooldowns.set(key, Date.now());
        return { allowed: true };
    }

    /**
     * Manually reset cooldown for a user+command
     * @param {string} userId - Discord user ID
     * @param {string} commandName - Command identifier
     */
    resetCooldown(userId, commandName) {
        const key = `${userId}_${commandName}`;
        this.cooldowns.delete(key);
    }

    /**
     * Cleanup old cooldown entries (older than 1 hour)
     * Should be called periodically
     */
    cleanup() {
        const ONE_HOUR = 3600000;
        const now = Date.now();
        let cleaned = 0;

        for (const [key, timestamp] of this.cooldowns.entries()) {
            if (now - timestamp > ONE_HOUR) {
                this.cooldowns.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[RateLimitService] Cleaned ${cleaned} old cooldown entries`);
        }
    }

    /**
     * Get current cooldown status for debugging
     * @param {string} userId - Discord user ID
     * @param {string} commandName - Command identifier
     * @returns {{active: boolean, remaining?: number}}
     */
    getStatus(userId, commandName) {
        const key = `${userId}_${commandName}`;
        const lastUsed = this.cooldowns.get(key);

        if (!lastUsed) {
            return { active: false };
        }

        const elapsed = Date.now() - lastUsed;
        return {
            active: true,
            elapsed: Math.floor(elapsed / 1000)
        };
    }
}

module.exports = RateLimitService;
