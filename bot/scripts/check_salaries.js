const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const guildId = process.env.GUILD_ID || '1398525215134318713';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Falta configuración de SUPABASE en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSalaries() {
    console.log('🔍 Buscando salarios existentes...');

    // Select all salaries for this guild
    const { data: salaries, error } = await supabase
        .from('job_salaries')
        .select('*')
        .eq('guild_id', guildId);

    if (error) {
        console.error('❌ Error fetching salaries:', error);
        return;
    }

    if (!salaries || salaries.length === 0) {
        console.log('⚠️ No hay salarios registrados en la base de datos.');
        return;
    }

    console.log('📋 Lista de Salarios:');
    // Sort by amount descending
    salaries.sort((a, b) => b.salary_amount - a.salary_amount);

    salaries.forEach(s => {
        console.log(`- ${s.role_name} (${s.role_id}): $${s.salary_amount.toLocaleString()}`);
    });
}

checkSalaries();
