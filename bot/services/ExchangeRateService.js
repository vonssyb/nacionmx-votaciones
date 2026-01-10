const moment = require('moment-timezone');

class ExchangeRateService {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} supabase 
     */
    constructor(supabase) {
        this.supabase = supabase;
        this.cachedRate = null;
        this.cacheTime = 0;
        this.CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Obtiene la tasa de cambio actual USD -> MXN
     * @returns {Promise<number>} Tasa actual (ej. 18.50)
     */
    async getCurrentRate() {
        // 1. Check Cache
        if (this.cachedRate && (Date.now() - this.cacheTime < this.CACHE_TTL)) {
            return parseFloat(this.cachedRate);
        }

        try {
            // 2. Fetch from DB (using the RPC function created in SQL)
            const { data, error } = await this.supabase
                .rpc('get_current_exchange_rate');

            if (error) throw error;

            // 3. Update Cache
            this.cachedRate = data || 18.50;
            this.cacheTime = Date.now();

            return parseFloat(this.cachedRate);
        } catch (error) {
            console.error('❌ [ExchangeService] Error fetching rate:', error.message);
            return 18.50; // Safe Fallback
        }
    }

    /**
     * Establece una tasa manual para el día de hoy
     * @param {string} adminTag - Tag del admin ejecutor
     * @param {number} rate - Nueva tasa (ej. 19.20)
     */
    async setManualRate(adminTag, rate) {
        try {
            const today = moment().tz('America/Mexico_City').format('YYYY-MM-DD');

            const { data, error } = await this.supabase
                .from('exchange_rates')
                .upsert({
                    rate_date: today,
                    rate_usd_to_mxn: rate,
                    set_by_admin: adminTag,
                    is_manual: true,
                    created_timestamp: new Date().toISOString()
                }, { onConflict: 'rate_date' })
                .select()
                .single();

            if (error) throw error;

            // Update Cache immediately
            this.cachedRate = rate;
            this.cacheTime = Date.now();

            console.log(`💱 [ExchangeService] Tasa actualizada a $${rate} por ${adminTag}`);
            return data;
        } catch (error) {
            console.error('❌ [ExchangeService] Error setting rate:', error.message);
            throw error;
        }
    }

    /**
     * Convierte una cantidad de una moneda a otra
     * @param {number} amount - Cantidad a convertir
     * @param {'USD'|'MXN'} fromCurrency - Moneda origen
     * @param {'USD'|'MXN'} toCurrency - Moneda destino
     */
    async convert(amount, fromCurrency, toCurrency) {
        const rate = await this.getCurrentRate();

        if (fromCurrency === 'USD' && toCurrency === 'MXN') {
            return Math.floor(amount * rate);
        } else if (fromCurrency === 'MXN' && toCurrency === 'USD') {
            return Math.floor(amount / rate);
        }

        return amount; // Same currency
    }
}

module.exports = ExchangeRateService;
