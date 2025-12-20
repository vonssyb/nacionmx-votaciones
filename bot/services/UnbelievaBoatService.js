const axios = require('axios');
const CacheService = require('./CacheService');

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

        // Initialize cache with 30 second TTL
        this.balanceCache = new CacheService(30000);

        // Cleanup expired entries every 5 minutes
        setInterval(() => {
            const cleaned = this.balanceCache.cleanup();
            if (cleaned > 0) {
                console.log(`[CACHE] Cleaned ${cleaned} expired entries`);
            }
        }, 300000);
    }

    /**
     * Retry wrapper for rate limiting
     * @param {Function} fn - Function to retry
     * @param {number} maxRetries - Maximum number of retries
     */
    async retryWithBackoff(fn, maxRetries = 3) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if it's a rate limit error
                if (error.response?.status === 429) {
                    const retryAfter = error.response.headers['retry-after'] || error.response.data?.retry_after || 60;
                    const waitTime = Math.min(retryAfter * 1000, 60000); // Max 60 seconds

                    console.warn(`⏱️ Rate limited. Waiting ${retryAfter}s before retry (${attempt + 1}/${maxRetries + 1})...`);

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
            console.log(`[CACHE HIT] ${cacheKey}`);
            return cached;
        }

        // Cache miss - fetch from API
        console.log(`[CACHE MISS] ${cacheKey}`);
        const result = await this.retryWithBackoff(async () => {
            try {
                const response = await this.client.get(`/guilds/${guildId}/users/${userId}`);
                return response.data;
            } catch (error) {
                console.error('Error fetching balance:', error.response?.data || error.message);
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
                console.error('Error removing money:', error.response?.data || error.message);
                throw new Error(error.response?.data?.message || error.message);
            }
        });

        // Invalidate cache after balance change
        this.balanceCache.invalidate(`balance:${guildId}:${userId}`);
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
                console.error('Error adding money:', error.response?.data || error.message);
                throw new Error(error.response?.data?.message || error.message);
            }
        });

        // Invalidate cache after balance change
        this.balanceCache.invalidate(`balance:${guildId}:${userId}`);
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
