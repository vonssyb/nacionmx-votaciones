const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Exportando Schema de Supabase...\n');

async function exportSchema() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Lista de tablas a exportar
    const tables = [
        'bot_heartbeats',
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
        'tickets',
        'sanctions',
        'dealership_vehicles',
        'dealership_purchases'
    ];

    let schema = `-- Supabase Schema Export
-- Generated: ${new Date().toISOString()}
-- Source: ${SUPABASE_URL}

`;

    console.log('📋 Exportando estructura de tablas...\n');

    for (const table of tables) {
        console.log(`   Procesando: ${table}`);

        try {
            // Obtener estructura de la tabla
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1);

            if (error) {
                console.log(`   ⚠️  Tabla ${table} no encontrada o error: ${error.message}`);
                continue;
            }

            // Obtener información de columnas
            const { data: tableInfo } = await supabase
                .rpc('get_table_info', { table_name: table })
                .catch(() => ({ data: null }));

            schema += `\n-- Table: ${table}\n`;
            schema += `-- Columns: ${data && data[0] ? Object.keys(data[0]).length : 'unknown'}\n`;

            if (data && data[0]) {
                schema += `-- Sample columns: ${Object.keys(data[0]).join(', ')}\n`;
            }

            schema += `\n`;

        } catch (err) {
            console.log(`   ❌ Error con ${table}: ${err.message}`);
        }
    }

    // Guardar schema
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }

    const schemaPath = path.join(exportsDir, 'supabase_schema.sql');
    fs.writeFileSync(schemaPath, schema);

    console.log(`\n✅ Schema exportado a: ${schemaPath}`);
    console.log(`\n📝 NOTA: Este es un schema simplificado.`);
    console.log(`   Para el schema completo, necesitas acceso directo a PostgreSQL.`);
    console.log(`\n💡 ALTERNATIVA:`);
    console.log(`   1. Ve a Supabase Dashboard → SQL Editor`);
    console.log(`   2. Ejecuta: SELECT * FROM information_schema.tables WHERE table_schema = 'public';`);
    console.log(`   3. Exporta manualmente desde el dashboard\n`);
}

exportSchema().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
