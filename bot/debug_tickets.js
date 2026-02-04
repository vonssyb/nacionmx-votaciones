const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTickets() {
    console.log('--- Checking Tickets Table ---');
    // Try to select specific columns to see if they exist
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from tickets:', error);
    } else {
        console.log('Tickets table exists.');
        if (data.length > 0) {
            console.log('Sample row keys:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, cannot verify columns by data.');
            // Try to insert a dummy row with "user_id" to see if it works, then delete it?
            // Or just trust the error from the bot.
            // Let's rely on the previous migration file content which usually represents the intent.
        }
    }
}

checkTickets();
