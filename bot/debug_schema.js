const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
// Try loading from current dir
dotenv.config({ path: path.join(__dirname, '.env') });
// Also try loading from parent dir if variables missing
if (!process.env.SUPABASE_URL) {
    console.log('Trying parent .env...');
    dotenv.config({ path: path.join(__dirname, '../.env') });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log('Checking schema for "citizen_dni" table...');

    try {
        const { data, error } = await supabase
            .from('citizen_dni')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Select Error:', error);
            // Try to force error to see columns
            const { error: insertError } = await supabase.from('citizen_dni').insert({
                discord_user_id: 'dummy_check',
                dni_number: 'nonexistent'
            });
            if (insertError) console.log('Insert Error:', insertError);

        } else if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('Table is empty. Checking via RPC if possible or just assuming.');
            // Try to insert a dummy to get schema error which often lists columns or at least constraints
            const { error: insertError } = await supabase.from('citizen_dni').insert({
                discord_user_id: 'dummy_check_123', // Use a dummy ID
                dni_number: '0000-0000-00000',
                curp: 'XXXX000000XXXXXX00',
                nombre: 'Test',
                fecha_nacimiento: '2000-01-01',
                sexo: 'M',
                estado_nacimiento: 'CDMX',
                domicilio: 'Test'
            });
            if (insertError) console.log('Insert Error:', insertError);
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
}

checkSchema();
