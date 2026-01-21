/**
 * @class CacheService
 * @description Servico de caché en memoria con soporte para TTL y fetch automático.
 * Diseñado para reducir la carga de la base de datos para datos estáticos/semi-estáticos.
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            keys: 0
        };
    }

    /**
     * Obtiene un valor del caché
     * @param {string} key - Clave del caché
     * @returns {any|null} Valor o null si no existe/expiró
     */
    get(key) {
        if (!this.cache.has(key)) {
            this.stats.misses++;
            return null;
        }

        const entry = this.cache.get(key);
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.keys--;
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Establece un valor en el caché
     * @param {string} key - Clave
     * @param {any} value - Valor a cachear
     * @param {number} ttlSeconds - Tiempo de vida en segundos (default 60s)
     */
    set(key, value, ttlSeconds = 60) {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { value, expiresAt });

        if (!this.cache.has(key)) {
            this.stats.keys++;
        }
    }

    /**
     * Elimina una clave
     * @param {string} key 
     */
    delete(key) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
            this.stats.keys--;
        }
    }

    /**
     * Limpia todo el caché
     */
    clear() {
        this.cache.clear();
        this.stats.keys = 0;
        this.stats.hits = 0;
        this.stats.misses = 0;
    }

    /**
     * Helper pattern: Get or Fetch
     * Intenta obtener del caché, si no existe ejecuta la función fetcher y guarda el resultado.
     * @param {string} key - Clave
     * @param {Function} fetcher - Función asíncrona que retorna el valor si no está en caché
     * @param {number} ttlSeconds - TTL en segundos
     * @returns {Promise<any>}
     */
    async getOrFetch(key, fetcher, ttlSeconds = 60) {
        const cached = this.get(key);
        if (cached !== null) return cached;

        try {
            const value = await fetcher();
            if (value !== undefined && value !== null) {
                this.set(key, value, ttlSeconds);
            }
            return value;
        } catch (error) {
            // Si el fetch falla, no cacheamos nada y propagamos error (o retornamos null)
            throw error;
        }
    }

    /**
     * Retorna estadísticas del caché
     */
    getStats() {
        return { ...this.stats, size: this.cache.size };
    }
}

module.exports = CacheService;
