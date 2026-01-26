const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    console.log('Checking credit_cards schema...');

    // Insert dummy to see error or select one
    const { data, error } = await supabase.from('credit_cards').select('*').limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else {
        console.log('Success. Row example:', data[0]);
    }

    // Check ticket handler hook
    console.log('Checking credit_cards_usd...');
    const { data: data2, error: error2 } = await supabase.from('credit_cards_usd').select('*').limit(1);
    if (error2) console.error('Error selecting USD:', error2);
    else console.log('Success USD:', data2[0]);
}

checkSchema();
