const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpc() {
    console.log('Testing get_election_results_v2 RPC...');

    // First, list elections to find a closed one
    const { data: elections, error: electError } = await supabase
        .from('elections')
        .select('*');

    if (electError) {
        console.error('Error fetching elections:', electError);
        return;
    }

    const closedElection = elections.find(e => e.end_date && new Date(e.end_date) < new Date());

    if (!closedElection) {
        console.log('No closed elections found to test.');
        return;
    }

    console.log(`Testing with Election ID: ${closedElection.id} (${closedElection.title})`);

    const { data, error } = await supabase.rpc('get_election_results_v2', { p_election_id: closedElection.id });

    if (error) {
        console.error('❌ RPC FAILED:', error);
        console.error('Updated Details:', JSON.stringify(error, null, 2));
    } else {
        console.log('✅ RPC SUCCESS:', data);
    }
}

testRpc();
