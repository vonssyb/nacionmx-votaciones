import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Environment Variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole || supabaseKey);

async function debugDNI() {
    console.log('--- Debugging Citizen DNI Table ---');

    // 1. Fetch first 5 rows to see structure and data types
    const { data: list, error } = await supabase
        .from('citizen_dni')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error fetching citizen_dni:', error);
    } else if (list.length > 0) {
        console.log('Columns found:', Object.keys(list[0]));
        console.log('First record:', list[0]);
    } else {
        console.log('No records found in citizen_dni');
    }

    // 2. Fetch a specific sample user if we have one from the list
    if (list && list.length > 0) {
        const sampleId = list[0].discord_user_id;
        console.log(`\nTesting query for Discord ID: ${sampleId}`);

        const { data: match, error: matchError } = await supabase
            .from('citizen_dni')
            .select('*')
            .eq('discord_user_id', sampleId); // Testing implicit type conversion

        console.log('Match result:', match ? `Found ${match.length} records` : 'No match', matchError || '');
    }
}

debugDNI();
