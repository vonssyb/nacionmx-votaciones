const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const UnbelievableBoatService = require('../services/UnbelievaBoatService');

const GUILD_ID = process.env.GUILD_ID;
const UB_TOKEN = process.env.UNBELIEVABOAT_TOKEN;
const TARGET_USER_ID = '826637667718266880';

async function main() {
    if (!UB_TOKEN) {
        console.error('❌ UNBELIEVABOAT_TOKEN is missing');
        return;
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const ubService = new UnbelievableBoatService(UB_TOKEN, supabase);

    console.log(`🔍 Checking balance for user ${TARGET_USER_ID} in guild ${GUILD_ID}...`);

    try {
        const balance = await ubService.getUserBalance(GUILD_ID, TARGET_USER_ID);
        console.log('--- RAW BALANCE DATA ---');
        console.log(balance);
        console.log('------------------------');
        console.log(`Cash Type: ${typeof balance.cash}`);
        console.log(`Bank Type: ${typeof balance.bank}`);
        console.log(`Is Cash Infinity? ${balance.cash === Infinity}`);
        console.log(`Is Bank Infinity? ${balance.bank === Infinity}`);

        const { data: card, error } = await supabase
            .from('debit_cards')
            .select('*')
            .eq('discord_user_id', TARGET_USER_ID)
            .maybeSingle();

        console.log('--- DEBIT CARD DATA ---');
        console.log(card || error);
        console.log('-----------------------');

        const { data: history, error: historyError } = await supabase
            .from('money_history')
            .select('*')
            .eq('user_id', TARGET_USER_ID)
            .order('amount', { ascending: false })
            .limit(5);

        console.log('--- TOP 5 INCOMING TRANSACTIONS ---');
        console.log(history || historyError);
        console.log('-----------------------------------');

        if (balance.cash === Infinity || balance.bank === Infinity || balance.cash > 1000000000000) {
            console.log('⚠️  DETECTED INFINITE OR MASSIVE MONEY!');

            // Ask to reset? No interaction here, just fix it if confirmed "Infinite" literally.
            if (process.argv.includes('--fix')) {
                console.log('🛠️  Fixing balance to 0...');
                await ubService.setBalance(GUILD_ID, TARGET_USER_ID, { cash: 0, bank: 0 }, "Fixing Infinite Money Bug");
                console.log('✅ Balance reset to 0.');
            } else {
                console.log('ℹ️  Run with --fix to reset balance to 0.');
            }
        } else {
            console.log('✅ Balance seems normal (finite).');
        }

    } catch (error) {
        console.error('❌ Error fetching balance:', error.message);
        if (error.response) console.error(error.response.data);
    }
}

main();
