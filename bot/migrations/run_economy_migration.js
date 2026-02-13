const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env from root
const envPath = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at:', envPath);
    process.exit(1);
}
dotenv.config({ path: envPath });

async function runMigration() {
    console.log('📦 Running Economy RPC Migration (Node.js)...');

    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:').replace('.supabase.co', '.supabase.co:5432');

    if (!connectionString) {
        console.error('❌ DATABASE_URL or SUPABASE_URL not found in .env');
        process.exit(1);
    }

    // Append sslmode if not present
    const finalConnectionString = connectionString.includes('sslmode') ? connectionString : `${connectionString}${connectionString.includes('?') ? '&' : '?'}sslmode=require`;

    const client = new Client({
        connectionString: finalConnectionString,
    });

    try {
        await client.connect();
        console.log('🔗 Connected to Database');

        const sqlPath = path.join(__dirname, 'rpc_economy_transactions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📜 Executing SQL...');
        await client.query(sql);

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
