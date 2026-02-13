const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root (../../.env)
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    // Try local .env (bot/.env)
    dotenv.config();
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL or SUPABASE_DB_URL not found in .env');
    console.error('Please add DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"');
    process.exit(1);
}

const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('🔗 Connected to Database');

        const sqlPath = path.join(__dirname, 'add_folio_and_public_results.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`📦 Running migration: ${path.basename(sqlPath)}`);
        await client.query(sql);

        console.log('✅ Migration success!');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
