const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('Checking schema for "casino_chips" table...');

    try {
        const { data, error } = await supabase
            .from('casino_chips')
            .select('*')
            .limit(1);

        console.log('Select result:', data);
        if (error) {
            console.error('Select Error:', error);
        } else if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('Table is empty or no data found.');
            // Insert dummy to force error and see columns if possible
            const { error: insertError } = await supabase.from('casino_chips').insert({
                discord_user_id: 'dummy_check',
                chips_balance: 0
            });
            if (insertError) {
                console.log('Insert Error (reveals schema?):', insertError);
            }
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
}

checkSchema();
