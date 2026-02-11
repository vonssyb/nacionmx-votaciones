const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function migrate() {
    console.log('Running Migration: add_voting_open_to_elections.sql');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is missing in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../migrations/add_voting_open_to_elections.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✅ Migration successful!');

    } catch (e) {
        console.error('❌ Migration Failed:', e);
    } finally {
        await client.end();
    }
}

migrate();
