const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Running Election System Migration...');
    const curDir = __dirname;
    const migrationFile = path.join(curDir, '../migrations/add_election_system.sql');

    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Executing SQL...');

        // Split by semicolon to handle multiple statements if needed, 
        // but Supabase JS client usually requires RPC for raw SQL or we can just try one big block if supported by PG extension 
        // OR we can use a direct PG client. 
        // Since we don't have direct PG client configured in this script, we'll use the 'rpc' method if 'exec_sql' exists 
        // or just try to use a pg client if available in node_modules.

        // Let's check if 'pg' is available (it is in package.json devDeps)
        const { Client } = require('pg');
        const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL; // Verify env vars

        // If we don't have DATABASE_URL (common with Supabase strict mode), we might fail.
        // Let's try to assume the user has a valid connection string in .env OR we use the supabase-js if there's a SQL exec function.

        // Fallback: Using a helper if exists, or just direct PG.
        // I'll try direct PG with the connection string from .env if it exists.

        // NOTE: The .env file usually has SUPABASE_URL and KEY. It MIGHT have DATABASE_URL.
        // Let's check .env content logic (I can't see it now, but I saw it in list_dir).

        // Heuristic: If we can't connect via PG, we'll try to use a known RPC 'exec_sql' or similar if it was set up in previous migrations.
        // Checking previous conversations/files, strictly usually we use `psql` or a script with `pg`.

        if (!process.env.DATABASE_URL) {
            console.log('❌ DATABASE_URL not found in .env. Attempting to construct from components or fail.');
            // Verification script usually just runs selects. 
            // We need to CREATE tables.
            // I will try to use the 'pg' library with a constructed URL if possible, otherwise I'll ask user to run it.
            // But wait, the bot has `query_logs.sql`, maybe there's a pattern.
            // Let's try to load 'pg' and connect.
        }

        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();
        await client.query(sql);
        console.log('✅ Migration executed successfully.');
        await client.end();

    } catch (e) {
        console.error('❌ Migration Error:', e);
    }
}

migrate();
