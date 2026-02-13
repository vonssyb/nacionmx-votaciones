const fs = require('fs');
const path = require('path');
const oracleClient = require('../lib/oracle');

console.log('📥 Importando datos a Oracle Cloud...\n');

async function importData() {
    try {
        // Inicializar cliente Oracle
        await oracleClient.init();

        const exportsDir = path.join(__dirname, '../exports');
        const summaryPath = path.join(exportsDir, 'export_summary.json');

        if (!fs.existsSync(summaryPath)) {
            console.error('❌ No se encontró export_summary.json');
            console.log('   Ejecuta primero: node scripts/export_supabase_data.js\n');
            process.exit(1);
        }

        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

        // Tablas en orden (respetando foreign keys)
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
            'bot_heartbeats'
        ];

        const importSummary = {
            timestamp: new Date().toISOString(),
            tables: {}
        };

        console.log('📋 Importando datos...\n');

        for (const table of tables) {
            const dataFile = path.join(exportsDir, `data_${table}.json`);

            if (!fs.existsSync(dataFile)) {
                console.log(`   ⚠️  Saltando ${table}: archivo no encontrado`);
                continue;
            }

            try {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

                if (!data || data.length === 0) {
                    console.log(`   ⏭️  ${table}: sin datos`);
                    importSummary.tables[table] = { rows: 0, status: 'empty' };
                    continue;
                }

                console.log(`   Importando ${table}: ${data.length} rows...`);

                let imported = 0;
                let errors = 0;

                for (const row of data) {
                    try {
                        // Preparar datos para Oracle
                        const oracleRow = prepareForOracle(row, table);

                        // Construir INSERT
                        const columns = Object.keys(oracleRow).join(', ');
                        const placeholders = Object.keys(oracleRow).map((_, i) => `:${i + 1}`).join(', ');
                        const values = Object.values(oracleRow);

                        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

                        await oracleClient.execute(sql, values);
                        imported++;

                    } catch (err) {
                        errors++;
                        if (errors <= 5) {
                            console.log(`      ⚠️  Error insertando row: ${err.message.substring(0, 100)}`);
                        }
                    }
                }

                console.log(`   ✅ ${table}: ${imported}/${data.length} rows importadas`);

                if (errors > 0) {
                    console.log(`      ⚠️  ${errors} errores`);
                }

                importSummary.tables[table] = {
                    totalRows: data.length,
                    imported,
                    errors,
                    status: 'completed'
                };

            } catch (err) {
                console.log(`   ❌ Error con ${table}: ${err.message}`);
                importSummary.tables[table] = { error: err.message, status: 'failed' };
            }
        }

        // Guardar resumen
        const importSummaryPath = path.join(exportsDir, 'import_summary.json');
        fs.writeFileSync(importSummaryPath, JSON.stringify(importSummary, null, 2));

        // Mostrar resumen
        console.log('\n═══════════════════════════════════════════════');
        console.log('📊 RESUMEN DE IMPORTACIÓN');
        console.log('═══════════════════════════════════════════════\n');

        let totalImported = 0;
        let totalErrors = 0;

        Object.entries(importSummary.tables).forEach(([table, info]) => {
            if (info.status === 'completed') {
                totalImported += info.imported;
                totalErrors += info.errors || 0;
                console.log(`   ✅ ${table}: ${info.imported} rows`);
            } else if (info.status === 'failed') {
                console.log(`   ❌ ${table}: ERROR - ${info.error}`);
            } else {
                console.log(`   ⏭️  ${table}: sin datos`);
            }
        });

        console.log(`\n📦 Total importado: ${totalImported} rows`);
        if (totalErrors > 0) {
            console.log(`⚠️  Total errores: ${totalErrors}`);
        }
        console.log(`💾 Resumen: ${importSummaryPath}\n`);

    } catch (err) {
        console.error('❌ Error fatal:', err);
    } finally {
        await oracleClient.close();
    }
}

// Preparar datos para Oracle
function prepareForOracle(row, tableName) {
    const prepared = {};

    for (const [key, value] of Object.entries(row)) {
        // Saltar columnas auto-generadas
        if (key === 'id' && value === null) {
            continue;
        }

        if (value === null || value === undefined) {
            prepared[key] = null;
        } else if (typeof value === 'boolean') {
            // Boolean → 0/1
            prepared[key] = value ? 1 : 0;
        } else if (typeof value === 'object') {
            // JSON → STRING
            prepared[key] = JSON.stringify(value);
        } else {
            prepared[key] = value;
        }
    }

    return prepared;
}

importData().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
