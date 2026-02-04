const logger = require('./Logger');

class TreasuryService {
    constructor(supabase, client) {
        this.supabase = supabase;
        this.client = client;
        this.TREASURY_KEY = 'govt_treasury_balance';
    }

    /**
     * Get current treasury balance
     */
    async getBalance(guildId) {
        const { data, error } = await this.supabase
            .from('server_settings')
            .select('value')
            .eq('guild_id', guildId)
            .eq('key', this.TREASURY_KEY)
            .maybeSingle();

        if (error) {
            logger.errorWithContext('[Treasury] Failed to fetch balance', error, { guildId });
            return 0;
        }

        return data ? parseInt(data.value) : 0;
    }

    /**
     * Add funds to treasury
     * @param {string} guildId 
     * @param {number} amount 
     * @param {string} source - e.g. "Taxes", "Licenses"
     * @param {string} details 
     */
    async addFunds(guildId, amount, source, details) {
        if (amount <= 0) return;

        try {
            // 1. Get current balance or init
            let current = await this.getBalance(guildId);
            
            // 2. Update (Upsert)
            const newBalance = current + amount;
            const { error } = await this.supabase
                .from('server_settings')
                .upsert({ 
                    guild_id: guildId, 
                    key: this.TREASURY_KEY, 
                    value: newBalance.toString(),
                    description: 'Fondos del Gobierno (Tesorería)'
                }, { onConflict: ['guild_id', 'key'] });

            if (error) throw error;

            // 3. Log Transaction
            await this.logTreasuryTransaction(guildId, amount, 'DEPOSIT', source, details, newBalance);

            return newBalance;
        } catch (err) {
            logger.errorWithContext('[Treasury] Failed to add funds', err, { guildId, amount, source });
        }
    }

    async logTreasuryTransaction(guildId, amount, type, source, reason, balanceAfter) {
        await this.supabase.from('treasury_logs').insert({
            guild_id: guildId,
            amount: amount,
            type: type, // DEPOSIT / WITHDRAW
            source: source,
            reason: reason,
            balance_after: balanceAfter
        }).catch(err => console.error('[Treasury] Log failed:', err.message));
    }
}

module.exports = TreasuryService;
