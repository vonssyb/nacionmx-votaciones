const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('Checking schema for "tickets" table...');

    // Check columns via RPC or by inserting a dummy row failure to see clearer error?
    // Better: Try to select * from tickets limit 1 to see returned structure, 
    // but empty table won't help.
    // Best: Query information_schema (if allowed) or try to insert a dummy row with all columns and see exact error.

    try {
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .limit(1);

        console.log('Select result:', data);
        if (error) console.error('Select Error:', error);

        // Try to insert a dummy one with all fields to see the specific error
        const { error: insertError } = await supabase.from('tickets').insert([{
            guild_id: 'test_schema',
            channel_id: 'test_' + Date.now(),
            user_id: 'test_user',
            ticket_type: 'test',
            status: 'OPEN',
            metadata: { test: true }
        }]);

        if (insertError) {
            console.error('Insert Test Failed:', JSON.stringify(insertError, null, 2));
        } else {
            console.log('Insert Test Success! Schema supports current columns.');
            // Clean up
            await supabase.from('tickets').delete().eq('guild_id', 'test_schema');
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
}

checkSchema();
