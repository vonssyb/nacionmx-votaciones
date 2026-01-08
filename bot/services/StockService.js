class StockService {
    constructor(supabase) {
        this.supabase = supabase;
        this.globalStocks = [
            // Crypto (high volatility)
            { symbol: 'BTC', name: 'Bitcoin', base: 842693, current: 842693, type: 'Cripto', volatility: 0.03 },
            { symbol: 'ETH', name: 'Ethereum', base: 55473, current: 55473, type: 'Cripto', volatility: 0.04 },
            { symbol: 'SOL', name: 'Solana', base: 2889, current: 2889, type: 'Cripto', volatility: 0.05 },
            // Tech Companies (medium volatility)
            { symbol: 'TSLA', name: 'Tesla Inc.', base: 4535, current: 4535, type: 'Empresa', volatility: 0.02 },
            { symbol: 'AMZN', name: 'Amazon', base: 3195, current: 3195, type: 'Empresa', volatility: 0.015 },
            { symbol: 'VNSSB', name: 'Vonssyb Studios', base: 2496, current: 2496, type: 'Empresa', volatility: 0.012 },
            // Mexican Companies (low volatility)
            { symbol: 'ALPEK', name: 'Alpek S.A.B. de C.V.', base: 147, current: 147, type: 'Empresa', volatility: 0.02 },
            { symbol: 'WALMEX', name: 'Walmart México', base: 449, current: 449, type: 'Empresa', volatility: 0.015 },
            { symbol: 'FEMSA', name: 'FEMSA', base: 1205, current: 1205, type: 'Empresa', volatility: 0.01 },
            { symbol: 'AMX', name: 'América Móvil', base: 800, current: 800, type: 'Empresa', volatility: 0.012 },
            { symbol: 'NMX', name: 'Nación MX Corp', base: 500, current: 500, type: 'Empresa', volatility: 0.025 }
        ];
    }

    updateStockPrices() {
        console.log('📉 Actualizando precios de bolsa...');
        this.globalStocks = this.globalStocks.map(stock => {
            const volatility = stock.volatility || 0.02;
            const variance = (Math.random() * (volatility * 2)) - volatility;
            const newPrice = Math.floor(stock.current * (1 + variance));

            const minPrice = Math.floor(stock.base * 0.5);
            const maxPrice = Math.floor(stock.base * 2.0);

            let finalPrice = newPrice;
            if (finalPrice < minPrice) finalPrice = minPrice;
            if (finalPrice > maxPrice) finalPrice = maxPrice;
            if (finalPrice < 1) finalPrice = 1;

            return { ...stock, current: finalPrice };
        });
        console.log('✅ Precios actualizados:', this.globalStocks.map(s => `${s.symbol}: $${s.current}`).join(', '));
    }

    getStocks() {
        return this.globalStocks;
    }

    getStock(symbol) {
        return this.globalStocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
    }
}

module.exports = StockService;
