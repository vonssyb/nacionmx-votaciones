
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            console.log('Keys:', Object.keys(data[0]));
        } else {
            console.log('No data found in credit_cards, cannot infer schema easily.');
            // Try to insert with a fake column to see error? No, that's risky.
            // Just assume we need to add it if I don't see it.
        }
    }
}

checkSchema();
