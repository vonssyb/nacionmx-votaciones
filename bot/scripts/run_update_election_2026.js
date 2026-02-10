const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    console.log('Running Election System Update 2026...');
    const curDir = __dirname;
    const migrationFile = path.join(curDir, '../migrations/update_election_2026.sql');

    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Executing SQL...');

        if (process.env.DATABASE_URL) {
            const client = new Client({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });

            await client.connect();
            await client.query(sql);
            console.log('✅ Migration executed successfully via PG Client.');
            await client.end();
        } else {
            console.log('⚠️ DATABASE_URL not found. Attempting via Supabase RPC (exec_sql)...');
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            // Split SQL into statements since RPC might only handle one at a time or we want to be safe
            // But actually, for this migration, it's mostly one big block or safe to run together if the RPC supports it.
            // Let's try sending the whole block first.
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

            if (error) {
                console.error('❌ RPC exec_sql failed:', error.message);
                console.error('You may need to run the SQL manually in the Supabase Dashboard SQL Editor.');
            } else {
                console.log('✅ Migration executed successfully via RPC.');
            }
        }

    } catch (e) {
        console.error('❌ Migration Error:', e);
    }
}

migrate();
