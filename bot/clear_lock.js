const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clearLocks() {
    console.log("🧹 Force clearing locks from 'bot_heartbeats'...");

    // Set last_heartbeat to 1970 to force expiry
    // Use a placeholder 'RESET' because the column is NOT NULL
    const { error } = await supabase
        .from('bot_heartbeats')
        .update({
            last_heartbeat: new Date(0).toISOString(),
            instance_id: 'RESET'
        })
        .neq('id', 'dummy');

    if (error) {
        console.error("Error clearing locks:", error);
    } else {
        console.log("✅ Locks successfully cleared/reset!");
    }
}

clearLocks();
