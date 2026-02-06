const { EmbedBuilder } = require('discord.js');
const EconomyHelper = require('./EconomyHelper');

class StockService {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Get all companies listed on the market
     */
    async getMarketData() {
        const { data, error } = await this.supabase
            .from('companies')
            .select('id, name, ticker, stock_price, volatility, total_shares, company_type, balance, last_balance')
            .not('ticker', 'is', null)
            .order('market_cap', { ascending: false });

        if (error) {
            console.error('[StockService] Error fetching market data:', error);
            return [];
        }
        return data;
    }

    /**
     * Generate a unique ticker for a company
     * @param {string} name 
     */
    generateTicker(name) {
        return name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
    }

    /**
     * Register a company in the stock market
     */
    async listCompany(companyId, ticker, initialPrice = 100.00, totalShares = 1000000) {
        const { error } = await this.supabase
            .from('companies')
            .update({
                ticker: ticker,
                stock_price: initialPrice,
                total_shares: totalShares,
                volatility: 0.05 // 5% base volatility
            })
            .eq('id', companyId);

        return !error;
    }

    /**
     * Buy stocks
     */
    async buyStock(userId, guildId, ticker, quantity, ubService) {
        if (quantity <= 0) return { success: false, message: 'La cantidad debe ser mayor a 0.' };

        // 1. Get Company & Price
        const { data: company } = await this.supabase
            .from('companies')
            .select('*')
            .eq('ticker', ticker)
            .single();

        if (!company) return { success: false, message: 'Empresa no encontrada.' };

        const totalCost = company.stock_price * quantity;

        // 2. Check Balance & Deduct Money
        const balance = await ubService.getUserBalance(guildId, userId);
        if (balance.bank < totalCost) {
            return {
                success: false,
                message: `Fondos insuficientes en banco. Costo: ${EconomyHelper.formatMoney(totalCost)}`
            };
        }

        await ubService.removeMoney(guildId, userId, totalCost, `Compra acciones ${ticker}`, 'bank');

        // 3. Update Portfolio
        const { data: existing } = await this.supabase
            .from('stock_portfolio')
            .select('*')
            .eq('user_id', userId)
            .eq('company_id', company.id)
            .maybeSingle();

        if (existing) {
            // Weighted Average Price
            const totalValue = (existing.average_buy_price * existing.quantity) + totalCost;
            const newQuantity = existing.quantity + quantity;
            const newAvgPrice = totalValue / newQuantity;

            await this.supabase.from('stock_portfolio').update({
                quantity: newQuantity,
                average_buy_price: newAvgPrice,
                updated_at: new Date().toISOString()
            }).eq('id', existing.id);
        } else {
            await this.supabase.from('stock_portfolio').insert({
                user_id: userId,
                guild_id: guildId,
                company_id: company.id,
                quantity: quantity,
                average_buy_price: company.stock_price
            });
        }

        // 4. Update Company Balance (IPO or Treasury? For now, money disappears or goes to treasury? 
        // Realistically, buying from secondary market doesn't pay the company unless it's new issuance.
        // For simulation simplicity: Money sinks (tax) or goes to a "Market Maker".
        // Let's sending 50% to company balance as "capital injection" if we want to support them.
        // For now: 100% money sink (deflationary) or Treasury.

        return { success: true, message: `Compraste ${quantity} acciones de ${ticker} por ${EconomyHelper.formatMoney(totalCost)}` };
    }

    /**
     * Sell stocks
     */
    async sellStock(userId, guildId, ticker, quantity, ubService) {
        if (quantity <= 0) return { success: false, message: 'La cantidad debe ser mayor a 0.' };

        const { data: company } = await this.supabase
            .from('companies')
            .select('*')
            .eq('ticker', ticker)
            .single();

        if (!company) return { success: false, message: 'Empresa no encontrada.' };

        // Get Portfolio
        const { data: holding } = await this.supabase
            .from('stock_portfolio')
            .select('*')
            .eq('user_id', userId)
            .eq('company_id', company.id)
            .maybeSingle();

        if (!holding || holding.quantity < quantity) {
            return { success: false, message: `No tienes suficientes acciones de ${ticker}.` };
        }

        const totalSale = company.stock_price * quantity;

        // Update Portfolio
        const newQuantity = holding.quantity - quantity;
        if (newQuantity === 0) {
            await this.supabase.from('stock_portfolio').delete().eq('id', holding.id);
        } else {
            await this.supabase.from('stock_portfolio').update({ quantity: newQuantity }).eq('id', holding.id);
        }

        // Add Money
        await ubService.addMoney(guildId, userId, totalSale, `Venta acciones ${ticker}`, 'bank');

        return { success: true, message: `Vendiste ${quantity} acciones de ${ticker} por ${EconomyHelper.formatMoney(totalSale)}` };
    }

    async getMarketData() {
        const { data, error } = await this.supabase
            .from('companies')
            .select('id, name, ticker, stock_price, volatility, total_shares, company_type, balance, last_balance')
            .not('ticker', 'is', null)
            .order('market_cap', { ascending: false });

        if (error) {
            console.error('[StockService] Error fetching market data:', error);
            return [];
        }
        return data;
    }

    // ... (generateTicker, listCompany, buyStock, sellStock remain similar) ...

    /**
     * Market Simulation Step (Update Prices)
     */
    async updateMarketPrices() {
        const companies = await this.getMarketData();

        for (const company of companies) {
            let newPrice = Number(company.stock_price);

            if (company.company_type === 'user') {
                // === REAL COMPANIES LOGIC (Book Value + Growth) ===
                // Price driven by actual Company Balance (Assets)
                const balance = Number(company.balance || 0);
                const lastBalance = Number(company.last_balance || balance);
                const shares = Number(company.total_shares || 1000000);

                // 1. Calculate Book Value Per Share (BVPS)
                const bookValue = balance / shares;

                // 2. Determine "Market Sentiment" (Random mult)
                // If balance grew, sentiment is positive.
                let sentiment = 1.0;
                if (balance > lastBalance) sentiment = 1.05; // 5% premium for growth
                else if (balance < lastBalance) sentiment = 0.95; // 5% discount for loss

                // 3. Target Price = Book Value * Sentiment
                // Enforce minimum $10 stock price (penny stock protection) or use $1.
                const targetPrice = Math.max(bookValue * sentiment, 1.00);

                // 4. Move Price towards Target (Dampening to avoid massive spikes)
                // Move 10% towards target per update
                newPrice = (newPrice * 0.90) + (targetPrice * 0.10);

                // Update last_balance for next time
                await this.supabase.from('companies').update({
                    stock_price: newPrice,
                    last_balance: balance
                }).eq('id', company.id);

            } else {
                // === SYSTEM/FICTIONAL COMPANIES LOGIC (Random Walk) ===
                const changePercent = (Math.random() - 0.5) * (company.volatility * 2); // +/- volatility
                newPrice = newPrice * (1 + changePercent);
                if (newPrice < 1) newPrice = 1;

                await this.supabase.from('companies').update({
                    stock_price: newPrice
                }).eq('id', company.id);
            }

            // Log History
            await this.supabase.from('stock_market_history').insert({
                company_id: company.id,
                price: newPrice
            });
        }
    }
}

module.exports = StockService;
