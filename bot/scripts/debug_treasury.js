const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
    console.log('🔍 Checking Treasury Tables...');

    // 1. Check server_settings
    console.log('1. Testing server_settings...');
    const { data: settings, error: settingsError } = await supabase
        .from('server_settings')
        .select('*')
        .limit(1);

    if (settingsError) {
        console.error('❌ server_settings Error:', settingsError.message);
    } else {
        console.log('✅ server_settings OK. Rows:', settings.length);
    }

    // 2. Check treasury_logs
    console.log('2. Testing treasury_logs...');
    const { data: logs, error: logsError } = await supabase
        .from('treasury_logs')
        .select('*')
        .limit(1);

    if (logsError) {
        console.error('❌ treasury_logs Error:', logsError.message);
    } else {
        console.log('✅ treasury_logs OK. Rows:', logs.length);
    }

    // 3. Try Upsert Settings
    console.log('3. Trying to Upsert Treasury Balance...');
    const { error: upsertError } = await supabase
        .from('server_settings')
        .upsert({
            guild_id: '123456789',
            key: 'test_treasury_balance',
            value: '500'
        }, { onConflict: ['guild_id', 'key'] });

    if (upsertError) {
        console.error('❌ Upsert Error:', upsertError.message);
    } else {
        console.log('✅ Upsert OK');
    }
}

checkTables();
