const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    console.log('Testing Dealership Tables...');
    const tables = ['dealership_catalog', 'dealership_sales', 'dealership_appointments', 'dealership_settings'];

    for (const table of tables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.error(`❌ Table '${table}' ERROR:`, error.message);
            } else {
                console.log(`✅ Table '${table}' exists. Rows: ${count}`);
            }
        } catch (e) {
            console.error(`❌ Table '${table}' EXCEPTION:`, e.message);
        }
    }
}

test();
