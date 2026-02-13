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
        if (amount === 0) return;

        try {
            // 1. Get current balance (default 0 if not found)
            let current = await this.getBalance(guildId);

            // 2. Update (Upsert)
            const newBalance = current + amount;

            // Validate sufficient funds for withdrawal
            if (newBalance < 0) {
                throw new Error('Fondos insuficientes en tesorería para realizar esta operación.');
            }

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
            const type = amount > 0 ? 'DEPOSIT' : 'WITHDRAW';
            const absAmount = Math.abs(amount);

            await this.logTreasuryTransaction(guildId, absAmount, type, source, details, newBalance);

            return newBalance;
        } catch (err) {
            logger.errorWithContext('[Treasury] Failed to add funds', err, { guildId, amount, source });
            throw err; // Rethrow to handle in command
        }
    }

    async logTreasuryTransaction(guildId, amount, type, source, reason, balanceAfter) {
        const { error } = await this.supabase.from('treasury_logs').insert({
            guild_id: guildId,
            amount: amount,
            type: type, // DEPOSIT / WITHDRAW
            source: source,
            reason: reason,
            balance_after: balanceAfter
        });

        if (error) {
            console.error('[Treasury] Log failed:', error.message);
        }
    }
}

module.exports = TreasuryService;
