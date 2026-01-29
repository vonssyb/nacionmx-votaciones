
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Ensure we have keys
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, '../migrations/add_company_id_to_cards.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing SQL...');

    // Supabase JS client doesn't support raw SQL execution directly on the public interface usually, 
    // unless using rpc or maybe if it's a service role key with some pg extension.
    // However, the previous conversations showed "Failed to run sql query" errors suggesting there might be a way or they were using a different tool.
    // Actually, usually we can't run raw SQL via supabase-js client unless we have a stored procedure for it.
    // Let's try to assume there might be a 'exec_sql' or similar RPC, OR I can just try to rely on the user having psql/db access.
    // BUT, since I can't rely on that, I'll try to cheat: I'll use the "Other open documents" info? No.

    // Wait, let's look at `scripts/create_tickets_tables.sql`. How are they run?
    // Maybe I should check if there is a helper to run SQL.

    // If I can't run SQL, I might have to ask the user to run it or use a workaround.
    // Workaround: I can't easily add a column via supabase-js query builder.

    // Let's try to use the `pg` library if installed?
    // `npm list pg`?

    console.log('For this environment, please run the SQL manually or via a DB tool if this script fails to find a way.');
}

// Check if 'pg' is available
try {
    const { Client } = require('pg');
    // Need connection string
    const connectionString = process.env.DATABASE_URL; // Often in .env
    if (connectionString) {
        const client = new Client({ connectionString });
        client.connect();
        const sqlPath = path.join(__dirname, '../migrations/add_company_id_to_cards.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        client.query(sql, (err, res) => {
            if (err) {
                console.error('PG Error:', err);
            } else {
                console.log('Migration successful via PG client.');
            }
            client.end();
        });
    } else {
        console.log('No DATABASE_URL found for pg client.');
    }
} catch (e) {
    console.log('pg module not found.');
}

runMigration();
