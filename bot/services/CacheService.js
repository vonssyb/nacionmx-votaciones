/**
 * CacheService - Simple in-memory cache with TTL
 * Used to reduce API calls to UnbelievaBoat
 */
class CacheService {
    /**
     * @param {number} ttlMs - Time to live in milliseconds (default: 30s)
     */
    constructor(ttlMs = 30000) {
        this.cache = new Map();
        this.ttl = ttlMs;
        this.stats = {
            hits: 0,
            misses: 0,
            invalidations: 0
        };
    }

    /**
     * Get cached value
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set cache value
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Invalidate cache entries by pattern
     * @param {string} pattern - String to match at start of key
     */
    invalidate(pattern) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.stats.invalidations += count;
        return count;
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, invalidations: 0 };
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: `${hitRate}%`,
            ttlSeconds: this.ttl / 1000
        };
    }

    /**
     * Clean up expired entries (call periodically)
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }
}

module.exports = CacheService;
