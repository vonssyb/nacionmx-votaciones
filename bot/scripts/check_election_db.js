const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkElectionTables() {
    console.log('🔍 Checking Election Tables...');

    // 1. Check elections table
    const { data: elections, error: eError } = await supabase
        .from('elections')
        .select('count', { count: 'exact', head: true });

    if (eError) {
        console.error('❌ Table "elections" NOT found or error:', eError.message);
    } else {
        console.log('✅ Table "elections" exists.');
    }

    // 2. Check election_candidates table
    const { data: candidates, error: cError } = await supabase
        .from('election_candidates')
        .select('count', { count: 'exact', head: true });

    if (cError) {
        console.error('❌ Table "election_candidates" NOT found or error:', cError.message);
    } else {
        console.log('✅ Table "election_candidates" exists.');
    }

    // 3. Check election_votes table
    const { data: votes, error: vError } = await supabase
        .from('election_votes')
        .select('count', { count: 'exact', head: true });

    if (vError) {
        console.error('❌ Table "election_votes" NOT found or error:', vError.message);
    } else {
        console.log('✅ Table "election_votes" exists.');
    }
}

checkElectionTables();
