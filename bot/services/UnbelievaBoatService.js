const axios = require('axios');
const CacheService = require('./CacheService');
const logger = require('./Logger');

class UnbelievableBoatService {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://unbelievaboat.com/api/v1';
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': this.token,
                'Accept': 'application/json'
            }
        });

        // Initialize cache with 5 second TTL (reduced from 30s for better UX)
        this.balanceCache = new CacheService(5000);

        // Note: CacheService (node-cache) auto-cleans expired entries
    }

    /**
     * Retry wrapper for rate limiting
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum number of retries
     */
    async retryWithBackoff(fn, maxRetries = 5) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if it's a rate limit error
                if (error.response?.status === 429 || error.message?.includes('rate limit')) {
                    const retryAfter = error.response?.headers['retry-after'] || error.response?.data?.retry_after || 5;
                    // Exponential backoff: 5s, 10s, 20s, 40s, 60s, 60s
                    const backoffTime = Math.min(retryAfter * Math.pow(2, attempt), 60);
                    const waitTime = backoffTime * 1000;

                    logger.warn(`Rate limited by UnbelievaBoat API. Waiting ${backoffTime}s before retry (${attempt + 1}/${maxRetries + 1})`);

                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }

                // If not rate limit or max retries reached, throw
                throw error;
            }
        }
        throw lastError;
    }

    /**
     * Get user balance
     * @param {string} guildId 
     * @param {string} userId 
     */
    async getUserBalance(guildId, userId) {
        const cacheKey = `balance:${guildId}:${userId}`;

        // Try cache first
        const cached = this.balanceCache.get(cacheKey);
        if (cached) {
            logger.debug(`Cache hit: ${cacheKey}`);
            return cached;
        }

        // Cache miss - fetch from API
        logger.debug(`Cache miss: ${cacheKey}`);
        const result = await this.retryWithBackoff(async () => {
            try {
                const response = await this.client.get(`/guilds/${guildId}/users/${userId}`);
                return response.data;
            } catch (error) {
                logger.errorWithContext('Failed to fetch user balance from UnbelievaBoat', error, { guildId, userId });
                throw error;
            }
        });

        // Store in cache
        this.balanceCache.set(cacheKey, result);
        return result;
    }

    /**
     * Modify user balance (remove money)
     * To remove money, use negative amount with 'update'? No, standard is usually Patch with 'cash' operation.
     * API Docs say: PATCH /guilds/{guild_id}/users/{user_id}
     * Body: { cash: number, bank: number, reason: string }
     * The number is the amount to SET or ADD? Default is usually relative or absolute depending on flags.
     * Let's check typical behavior: Usually 'cash' adds if positive, removes if negative.
     */
    async removeMoney(guildId, userId, amount, reason = "Cobro Banco NMX", type = 'bank') {
        const result = await this.retryWithBackoff(async () => {
            try {
                const payload = { reason: reason };
                if (type === 'cash') {
                    payload.cash = -Math.abs(amount);
                } else {
                    payload.bank = -Math.abs(amount);
                }
                const response = await this.client.patch(`/guilds/${guildId}/users/${userId}`, payload);
                return { success: true, newBalance: response.data };
            } catch (error) {
                logger.errorWithContext('Failed to remove money from user', error, { guildId, userId, amount, type });
                throw new Error(error.response?.data?.message || error.message);
            }
        });

        // Invalidate cache after balance change
        this.balanceCache.del(`balance:${guildId}:${userId}`);
        return result;
    }

    /**
     * Add money to user balance
     */
    async addMoney(guildId, userId, amount, reason = "Préstamo Banco NMX", type = 'bank') {
        const result = await this.retryWithBackoff(async () => {
            try {
                const payload = { reason: reason };
                if (type === 'cash') {
                    payload.cash = Math.abs(amount);
                } else {
                    payload.bank = Math.abs(amount);
                }
                const response = await this.client.patch(`/guilds/${guildId}/users/${userId}`, payload);
                return { success: true, newBalance: response.data };
            } catch (error) {
                logger.errorWithContext('Failed to add money to user', error, { guildId, userId, amount, type });
                throw new Error(error.response?.data?.message || error.message);
            }
        });

        // Invalidate cache after balance change safely
        try {
            if (this.balanceCache && typeof this.balanceCache.del === 'function') {
                this.balanceCache.del(`balance:${guildId}:${userId}`);
            }
        } catch (cacheError) {
            console.warn('[UnbelievaBoat] Failed to invalidate cache:', cacheError.message);
        }
        return result;
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getCacheStats() {
        return this.balanceCache.getStats();
    }
}

module.exports = UnbelievableBoatService;
