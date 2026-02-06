const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log('Debugging Dealership Deep...');

    // Check Settings
    try {
        const keys = ['channel_tickets', 'role_staff'];
        for (const key of keys) {
            const { data, error } = await supabase.from('dealership_settings').select('*').eq('key', key).single();
            if (error) {
                console.error(`❌ Setting '${key}' Error:`, error.message, error.code);
            } else {
                console.log(`✅ Setting '${key}' found:`, data.value);
            }
        }
    } catch (e) {
        console.error('❌ Settings Exception:', e);
    }

    // Check Credit Cards Structure
    try {
        console.log('Checking credit_cards table structure...');
        const { data, error } = await supabase.from('credit_cards').select('*').limit(1);
        if (error) {
            console.error('❌ credit_cards Error:', error.message);
        } else {
            if (data.length > 0) {
                console.log('✅ credit_cards columns:', Object.keys(data[0]));
                console.log('Sample row:', data[0]);
            } else {
                console.log('✅ credit_cards table exists but is empty.');
                // Insert dummy to check schemas if needed, or just rely on empty list
            }
        }
    } catch (e) {
        console.error('❌ credit_cards Exception:', e);
    }
}

debug();
