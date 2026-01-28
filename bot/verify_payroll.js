const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugNominaLogic() {
    console.log('🔍 Debugging Nomina Logic...');

    // 1. Check Companies Table
    console.log('👉 Checking `companies` table...');
    const { data: companies, error: companyError } = await supabase.from('companies').select('*').limit(1);

    if (companyError) {
        console.error('❌ Error querying companies:', companyError);
    } else {
        console.log('✅ `companies` table checks out. Found ' + companies.length + ' rows (limit 1).');
        if (companies.length > 0) {
            console.log('   Sample Company:', JSON.stringify(companies[0]));
        }
    }

    // 2. Check Payroll Groups Table
    console.log('👉 Checking `payroll_groups` table...');
    const { data: groups, error: groupError } = await supabase.from('payroll_groups').select('*').limit(1);

    if (groupError) {
        console.error('❌ Error querying payroll_groups:', groupError);
    } else {
        console.log('✅ `payroll_groups` table checks out.');
    }

    // 3. Check for specific columns by selecting them
    const { error: colError } = await supabase.from('payroll_groups').select('owner_discord_id').limit(1);
    if (colError) {
        console.error('❌ `owner_discord_id` check failed:', colError);
    } else {
        console.log('✅ `owner_discord_id` column seems accessible.');
    }

    const { error: colError2 } = await supabase.from('payroll_groups').select('company_id').limit(1);
    if (colError2) {
        console.error('❌ `company_id` check failed:', colError2);
    } else {
        console.log('✅ `company_id` column seems accessible.');
    }

    // 4. Inspect Indexes/Relations if possible (hard via JS client without RPC)
    // We can try to insert a dummy row that is meant to fail FK to confirm FK exists
    // But better not to pollute if we can avoid it.

    console.log('🏁 Debug check complete.');
}

debugNominaLogic();
