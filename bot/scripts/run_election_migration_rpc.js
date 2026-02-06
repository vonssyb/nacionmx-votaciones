const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Running Election System Migration via Direct JS...');
    const curDir = __dirname;
    const migrationFile = path.join(curDir, '../migrations/add_election_system.sql');

    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Read SQL file. Splitting statements...');

        // Split by semicolon, but be careful with functions/strings. 
        // For this specific migration, we don't have complex functions with semicolons inside strings.
        // We can split by `;\n` to be safer or just by `;` 
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            // We use a trick if we don't have direct SQL access:
            // 1. If we have a 'exec_sql' RPC function (common in these setups)
            // 2. Or we try to see if we can just skip this and use a manual approach?
            // Let's assume we don't have exec_sql.
            // BUT, Supabase JS client doesn't support raw SQL unless via RPC.

            // Let's check if there is an `exec_sql` or `query` rpc.
            const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

            if (error) {
                console.warn(`RPC exec_sql failed (maybe function missing): ${error.message}`);
                // If RPC fails, we can't do much without PG client.
                // However, I see `pg` in package.json.
                // I will try to connect using the "postgres" connection string derived from Supabase URL?
                // No, Supabase URL is https. DB URL is usually `postgres://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres`
                // We don't have the password in .env clearly (only service role key).

                // CRITICAL: We need to execute `CREATE TABLE`.
                // If we can't via JS, we might need to ask user or use a workaround.
                // Workaround: We can't use Service Key for raw SQL in client.

                // Let's try to see if `exec` exists.
            } else {
                console.log('✅ Success via RPC');
            }
        }

    } catch (e) {
        console.error('❌ Migration Error:', e);
    }
}

// Check if we can use PG with a constructed URL? 
// The password is typically NOT in the service_role_key. 
// So we really rely on an existing RPC function for raw SQL if we don't have the password.

// Let's try to verify if `exec_sql` exists by calling it with a simple select.
async function checkRpc() {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
    if (error) {
        console.log('⚠️ `exec_sql` RPC not found or error:', error.message);
        console.log('ℹ️ Attempting to create it? No, we can\'t create function without SQL access.');
        console.log('❌ CANNOT RUN MIGRATION AUTOMATICALLY without DB_URL or RPC.');
    } else {
        console.log('✅ `exec_sql` RPC exists! Proceeding with migration.');
        await migrate();
    }
}

checkRpc();
