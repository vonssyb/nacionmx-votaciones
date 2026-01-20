#!/usr/bin/env node
/**
 * Apply Database Migrations
 * 
 * Este script ejecuta las migraciones SQL necesarias para el StateManager
 * Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
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

async function runMigration() {
    console.log('🔄 Ejecutando migración: pending_actions...\n');

    const migrationPath = path.join(__dirname, '..', 'migrations', '003_create_pending_actions.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Archivo de migración no encontrado: ${migrationPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        // Execute SQL (Note: Supabase JS client doesn't support raw SQL)
        // This is a workaround using RPC
        console.log('⚠️  IMPORTANTE:');
        console.log('   La migración SQL debe ejecutarse manualmente en Supabase Dashboard.');
        console.log('   Sigue estos pasos:\n');
        console.log('   1. Ve a https://supabase.com/dashboard');
        console.log('   2. Selecciona tu proyecto');
        console.log('   3. Ve a SQL Editor');
        console.log('   4. Copia y pega el siguiente SQL:\n');
        console.log('━'.repeat(80));
        console.log(sql);
        console.log('━'.repeat(80));
        console.log('\n   5. Ejecuta el SQL');
        console.log('\n✅ Una vez completado, el bot podrá usar StateManager\n');

        // Verify table exists (after manual execution)
        console.log('📝 Para verificar la migración, ejecuta:');
        console.log('   SELECT * FROM pending_actions LIMIT 1;\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

runMigration();
