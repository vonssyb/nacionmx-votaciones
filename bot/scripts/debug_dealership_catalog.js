const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log('Debugging Dealership Catalog...');

    // 1. Try to list all tables (if possible via rpc or just testing)
    // 2. Try simple select

    try {
        console.log('Attempting SELECT * FROM dealership_catalog LIMIT 1...');
        const { data, error } = await supabase.from('dealership_catalog').select('*').limit(1);
        if (error) {
            console.error('❌ SELECT Error:', error);
        } else {
            console.log('✅ SELECT Success. Data:', data);
        }
    } catch (e) {
        console.error('❌ SELECT Exception:', e);
    }

    try {
        console.log('Attempting INSERT...');
        const { data, error } = await supabase.from('dealership_catalog').insert({
            make: 'TestMake',
            model: 'TestModel',
            category: 'sedan',
            price: 10000,
            stock: 1
        }).select();

        if (error) {
            console.error('❌ INSERT Error:', error);
        } else {
            console.log('✅ INSERT Success:', data);
            // Cleanup
            await supabase.from('dealership_catalog').delete().eq('id', data[0].id);
        }
    } catch (e) {
        console.error('❌ INSERT Exception:', e);
    }
}

debug();
