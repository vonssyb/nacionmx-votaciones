const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testVenderQueries() {
    console.log('--- Testing /vender dependencies ---');

    // 1. Check dealership_catalog
    console.log('Querying dealership_catalog...');
    const { data: catalog, error: catError } = await supabase
        .from('dealership_catalog')
        .select('*')
        .limit(1);

    if (catError) {
        console.error('❌ Error querying dealership_catalog:', catError);
    } else {
        console.log('✅ dealership_catalog access OK. Rows:', catalog.length);
        if (catalog.length > 0) console.log('Sample vehicle:', catalog[0]);
    }

    // 2. Check credit_cards
    console.log('\nQuerying credit_cards...');
    const { data: cards, error: cardError } = await supabase
        .from('credit_cards')
        .select('*')
        .limit(1);

    if (cardError) {
        console.error('❌ Error querying credit_cards:', cardError);
    } else {
        console.log('✅ credit_cards access OK. Rows:', cards.length);
    }
}

testVenderQueries();
