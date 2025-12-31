
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function checkTables() {
    console.log('🔍 Checking database tables...');

    // Check moderator_status
    const { data: d1, error: e1 } = await supabase.from('moderator_status').select('count').limit(1);
    if (e1) console.log('❌ Table moderator_status ERROR:', e1.message);
    else console.log('✅ Table moderator_status exists');

    // Check activo_embed_messages
    const { data: d2, error: e2 } = await supabase.from('activo_embed_messages').select('count').limit(1);
    if (e2) console.log('❌ Table activo_embed_messages ERROR:', e2.message);
    else console.log('✅ Table activo_embed_messages exists');
}

checkTables();
