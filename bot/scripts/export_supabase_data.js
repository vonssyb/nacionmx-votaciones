const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📦 Exportando Datos de Supabase...\n');

async function exportData() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Tablas a exportar en orden (respetando foreign keys)
    const tables = [
        'citizens',
        'debit_cards',
        'credit_cards',
        'debit_transactions',
        'companies',
        'user_purchases',
        'casino_chips',
        'tax_evasion_history',
        'pending_transfers',
        'giro_transfers',
        'privacy_accounts',
        'bot_heartbeats',
        'tickets',
        'sanctions',
        'dealership_vehicles',
        'dealership_purchases'
    ];

    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }

    const exportSummary = {
        timestamp: new Date().toISOString(),
        source: SUPABASE_URL,
        tables: {}
    };

    console.log('📋 Exportando datos de tablas...\n');

    for (const table of tables) {
        try {
            console.log(`   Exportando: ${table}...`);

            // Obtener todos los datos de la tabla
            let allData = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .range(from, from + batchSize - 1);

                if (error) {
                    console.log(`   ⚠️  Error en ${table}: ${error.message}`);
                    exportSummary.tables[table] = { error: error.message, rows: 0 };
                    hasMore = false;
                    continue;
                }

                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(data);
                    from += batchSize;

                    if (data.length < batchSize) {
                        hasMore = false;
                    }
                }
            }

            // Guardar datos
            const dataPath = path.join(exportsDir, `data_${table}.json`);
            fs.writeFileSync(dataPath, JSON.stringify(allData, null, 2));

            console.log(`   ✅ ${table}: ${allData.length} rows`);
            exportSummary.tables[table] = { rows: allData.length, file: `data_${table}.json` };

        } catch (err) {
            console.log(`   ❌ Error con ${table}: ${err.message}`);
            exportSummary.tables[table] = { error: err.message, rows: 0 };
        }
    }

    // Guardar resumen
    const summaryPath = path.join(exportsDir, 'export_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(exportSummary, null, 2));

    // Mostrar resumen
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RESUMEN DE EXPORTACIÓN');
    console.log('═══════════════════════════════════════════════\n');

    const totalRows = Object.values(exportSummary.tables)
        .reduce((sum, t) => sum + (t.rows || 0), 0);
    const successfulTables = Object.values(exportSummary.tables)
        .filter(t => !t.error).length;

    console.log(`✅ Tablas exportadas: ${successfulTables}/${tables.length}`);
    console.log(`📦 Total de rows: ${totalRows.toLocaleString()}`);
    console.log(`📁 Ubicación: ${exportsDir}\n`);

    console.log('Detalles por tabla:');
    Object.entries(exportSummary.tables).forEach(([table, info]) => {
        if (info.error) {
            console.log(`   ❌ ${table}: ERROR - ${info.error}`);
        } else {
            console.log(`   ✅ ${table}: ${info.rows} rows`);
        }
    });

    console.log(`\n💾 Resumen guardado en: ${summaryPath}\n`);
}

exportData().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
