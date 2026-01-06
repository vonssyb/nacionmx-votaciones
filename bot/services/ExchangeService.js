const logger = require('./Logger');

class ExchangeService {
    constructor(supabase, ubService) {
        this.supabase = supabase;
        this.ubService = ubService;
    }

    async getRate(guildId) {
        const { data, error } = await this.supabase
            .from('exchange_rates')
            .select('mxn_to_usd')
            .eq('guild_id', guildId)
            .maybeSingle();

        return data ? parseFloat(data.mxn_to_usd) : 22.50;
    }

    async getUserBalances(guildId, userId) {
        // 1. Get MXN from UnbelievaBoat
        const mxn = await this.ubService.getUserBalance(guildId, userId);

        // 2. Get USD from Supabase
        const { data: usdData } = await this.supabase
            .from('user_usd_balances')
            .select('usd_cash, usd_bank')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .maybeSingle();

        return {
            mxn: {
                cash: mxn.cash || 0,
                bank: mxn.bank || 0,
                total: (mxn.cash || 0) + (mxn.bank || 0)
            },
            usd: {
                cash: usdData ? parseFloat(usdData.usd_cash) : 0,
                bank: usdData ? parseFloat(usdData.usd_bank) : 0,
                total: (usdData ? parseFloat(usdData.usd_cash) : 0) + (usdData ? parseFloat(usdData.usd_bank) : 0)
            }
        };
    }

    async buyUSD(guildId, userId, amountUSD) {
        const rate = await this.getRate(guildId);
        const costMXN = Math.ceil(amountUSD * rate);

        // 1. Check MXN balance
        const balances = await this.getUserBalances(guildId, userId);
        if (balances.mxn.total < costMXN) {
            throw new Error(`Fondos insuficientes en MXN. Necesitas $${costMXN.toLocaleString()} MXN.`);
        }

        // 2. Deduct MXN
        // We take from bank first
        const bankDeduct = Math.min(costMXN, balances.mxn.bank);
        const cashDeduct = costMXN - bankDeduct;

        if (bankDeduct > 0) await this.ubService.removeMoney(guildId, userId, bankDeduct, `Compra de $${amountUSD} USD`, 'bank');
        if (cashDeduct > 0) await this.ubService.removeMoney(guildId, userId, cashDeduct, `Compra de $${amountUSD} USD`, 'cash');

        // 3. Add USD to Supabase
        const { error } = await this.supabase.rpc('exchange_currency', {
            p_guild_id: guildId,
            p_user_id: userId,
            p_amount_mxn: costMXN,
            p_amount_usd: amountUSD,
            p_direction: 'to_usd'
        });

        if (error) throw error;
        return { costMXN, rate };
    }

    async sellUSD(guildId, userId, amountUSD) {
        const rate = await this.getRate(guildId);
        const gainMXN = Math.floor(amountUSD * rate);

        // 1. Check USD balance
        const balances = await this.getUserBalances(guildId, userId);
        if (balances.usd.total < amountUSD) {
            throw new Error(`Fondos insuficientes en USD. Tienes $${balances.usd.total} USD.`);
        }

        // 2. Deduct USD from Supabase
        const { error } = await this.supabase.rpc('exchange_currency', {
            p_guild_id: guildId,
            p_user_id: userId,
            p_amount_mxn: gainMXN,
            p_amount_usd: amountUSD,
            p_direction: 'to_mxn'
        });

        if (error) throw error;

        // 3. Add MXN to UnbelievaBoat
        await this.ubService.addMoney(guildId, userId, gainMXN, `Venta de $${amountUSD} USD`, 'bank');

        return { gainMXN, rate };
    }
}

module.exports = ExchangeService;
