const { createClient } = require('../bot/node_modules/@supabase/supabase-js');
const StockService = require('../bot/services/StockService.js');
require('../bot/node_modules/dotenv').config({ path: './.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Credenciales de Supabase no encontradas.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stockService = new StockService(supabase);

async function backfillTickers() {
    console.log('🔄 Iniciando backfill de tickers...');

    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, ticker')
        .is('ticker', null);

    if (error) {
        console.error('❌ Error obteniendo empresas:', error);
        return;
    }

    if (!companies || companies.length === 0) {
        console.log('✅ No hay empresas sin ticker.');
        return;
    }

    console.log(`📝 Procesando ${companies.length} empresas...`);

    let updated = 0;
    for (const company of companies) {
        // Generate Ticker (First 3-4 chars uppercase)
        let ticker = stockService.generateTicker(company.name);

        // Ensure uniqueness (simple check, append number if exists)

        let attempts = 0;
        let success = false;

        while (!success && attempts < 5) {
            const currentTicker = attempts === 0 ? ticker : `${ticker.substring(0, 3)}${attempts}`;

            // Check existence
            const { data: existing } = await supabase.from('companies').select('id').eq('ticker', currentTicker).maybeSingle();

            if (!existing) {
                // Update
                const { error: updateError } = await supabase
                    .from('companies')
                    .update({
                        ticker: currentTicker,
                        stock_price: 100.00, // Default IPO price
                        total_shares: 1000000
                    })
                    .eq('id', company.id);

                if (!updateError) {
                    console.log(`✅ ${company.name} -> ${currentTicker}`);
                    success = true;
                    updated++;
                } else {
                    console.error(`Error updating ${company.name}:`, updateError.message);
                    attempts++;
                }
            } else {
                attempts++;
            }
        }
    }

    console.log(`\n🎉 Completado. ${updated} empresas actualizadas con tickers.`);
    process.exit(0);
}

backfillTickers();
