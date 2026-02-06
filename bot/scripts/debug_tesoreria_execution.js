const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const UnbelievaBoatService = require('../services/UnbelievaBoatService');
const TreasuryService = require('../services/TreasuryService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const UB_TOKEN = process.env.UNBELIEVABOAT_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1398525215134318713'; // Use from env or fallback

async function testTesoreria() {
    console.log('🚀 Starting Tesoreria Debug...');
    console.log('GUILD_ID:', GUILD_ID);
    console.log('User ID (Test):', '1412882245735420006'); // Using a known ID or similar

    // 1. Init Services
    const ubService = new UnbelievaBoatService(UB_TOKEN, supabase);
    const treasuryService = new TreasuryService(supabase, { user: { tag: 'TestBot' } }); // Mock client

    // 2. Test UB Balance
    console.log('\n2. Testing UB Balance...');
    try {
        const balance = await ubService.getUserBalance(GUILD_ID, '314543781223936001'); // Using generic ID or my ID if I knew it.
        // Let's use a real ID if possible. '314543781223936001' is placeholder.
        // I will use a random ID that likely doesn't exist to see if it handles 404.
        console.log('Balance result:', balance);
    } catch (e) {
        console.error('❌ UB Balance Error:', e.message);
        if (e.response) console.error('Response:', e.response.status, e.response.data);
    }

    // 3. Test Treasury Balance
    console.log('\n3. Testing Treasury Balance...');
    try {
        const tBalance = await treasuryService.getBalance(GUILD_ID);
        console.log('Treasury Balance:', tBalance);
    } catch (e) {
        console.error('❌ Treasury Balance Error:', e.message);
    }

    // 4. Test Add Funds (Simulate Deposit)
    console.log('\n4. Testing Add Funds (Dry Run)...');
    try {
        // We won't actually add funds to avoid messing up DB, but we can call it if we want.
        // treasuryService.addFunds(GUILD_ID, 1, 'DEBUG_TEST', 'Test Deposit');
        console.log('Skipping actual write for safety, but method exists.');
    } catch (e) {
        console.error('❌ Add Funds Error:', e.message);
    }
}

testTesoreria();
