const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Running Voting Open Migration via RPC...');
    const curDir = __dirname;
    const migrationFile = path.join(curDir, '../migrations/add_voting_open_to_elections.sql');

    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

            if (error) {
                console.error(`❌ RPC failed: ${error.message}`);
                process.exit(1);
            } else {
                console.log('✅ Success');
            }
        }
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

migrate();
