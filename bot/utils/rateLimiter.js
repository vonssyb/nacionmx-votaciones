const logger = require('./logger');

/**
 * Rate Limiter to prevent command spam
 * Limits users to X commands per Y seconds
 */
class RateLimiter {
    constructor(maxCommands = 5, windowMs = 10000) {
        this.maxCommands = maxCommands; // 5 commands
        this.windowMs = windowMs; // per 10 seconds
        this.users = new Map(); // userId -> { count, resetTime }

        // Cleanup old entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if user is rate limited
     * @param {string} userId - Discord user ID
     * @returns {boolean} True if allowed, false if rate limited
     */
    check(userId) {
        const now = Date.now();
        const userLimit = this.users.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            // First request or window expired
            this.users.set(userId, {
                count: 1,
                resetTime: now + this.windowMs
            });
            return true;
        }

        if (userLimit.count >= this.maxCommands) {
            const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000);
            logger.warn(`Rate limit exceeded for user ${userId}`, {
                userId,
                count: userLimit.count,
                remainingSeconds: remainingTime
            });
            return false;
        }

        userLimit.count++;
        return true;
    }

    /**
     * Get remaining time for rate limited user
     * @param {string} userId - Discord user ID
     * @returns {number} Seconds remaining until reset
     */
    getRemainingTime(userId) {
        const userLimit = this.users.get(userId);
        if (!userLimit) return 0;

        const now = Date.now();
        if (now > userLimit.resetTime) return 0;

        return Math.ceil((userLimit.resetTime - now) / 1000);
    }

    /**
     * Reset rate limit for a user
     * @param {string} userId - Discord user ID
     */
    reset(userId) {
        this.users.delete(userId);
        logger.info(`Rate limit reset for user ${userId}`);
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [userId, data] of this.users.entries()) {
            if (now > data.resetTime) {
                this.users.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} expired rate limit entries`);
        }
    }

    /**
     * Get current stats
     * @returns {Object} Rate limiter statistics
     */
    getStats() {
        return {
            activeUsers: this.users.size,
            maxCommands: this.maxCommands,
            windowSeconds: this.windowMs / 1000
        };
    }
}

// Export singleton instance
module.exports = new RateLimiter(5, 10000);
