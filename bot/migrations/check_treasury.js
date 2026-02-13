const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('🔍 Checking treasury tables...');

    const { error: error1 } = await supabase.from('server_settings').select('count', { count: 'exact', head: true });
    if (error1) console.error('❌ server_settings:', error1.message);
    else console.log('✅ server_settings exists');

    const { error: error2 } = await supabase.from('treasury_logs').select('count', { count: 'exact', head: true });
    if (error2) console.error('❌ treasury_logs:', error2.message);
    else console.log('✅ treasury_logs exists');
}

check();
