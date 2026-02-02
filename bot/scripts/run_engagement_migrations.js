#!/usr/bin/env node
/**
 * Execute Engagement Systems Migrations
 * Runs the 3 new migrations for streaks, events, and daily rewards
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY requeridos');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const migrations = [
    'create_streaks_table.sql',
    'create_events_table.sql',
    'create_daily_rewards_table.sql'
];

async function runMigrations() {
    console.log('🚀 Ejecutando migraciones de sistemas de engagement...\n');

    for (const migrationFile of migrations) {
        const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

        if (!fs.existsSync(migrationPath)) {
            console.error(`❌ Archivo no encontrado: ${migrationFile}`);
            continue;
        }

        console.log(`📄 Ejecutando: ${migrationFile}...`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        try {
            // Use RPC to execute raw SQL
            const { data, error } = await supabase.rpc('exec_sql', { query: sql });

            if (error) {
                // If exec_sql doesn't exist, show manual instructions
                if (error.message.includes('function') || error.code === '42883') {
                    console.log(`⚠️  Ejecuta manualmente en Supabase Dashboard:\n`);
                    console.log('━'.repeat(80));
                    console.log(sql);
                    console.log('━'.repeat(80));
                    console.log('');
                } else {
                    throw error;
                }
            } else {
                console.log(`✅ ${migrationFile} ejecutada exitosamente\n`);
            }
        } catch (error) {
            console.error(`❌ Error en ${migrationFile}:`, error.message);
            console.log(`\n⚠️  Ejecuta manualmente en Supabase SQL Editor:\n`);
            console.log('━'.repeat(80));
            console.log(sql);
            console.log('━'.repeat(80));
            console.log('');
        }
    }

    console.log('\n✅ Proceso de migraciones completado');
    console.log('\n📝 Verifica las tablas creadas ejecutando:');
    console.log('   SELECT * FROM user_streaks LIMIT 1;');
    console.log('   SELECT * FROM server_events LIMIT 1;');
    console.log('   SELECT * FROM daily_rewards LIMIT 1;\n');
}

runMigrations().then(() => process.exit(0)).catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
