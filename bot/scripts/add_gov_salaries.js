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

const SALARIES = [
    { role_id: '1466165678980464802', role_name: 'Vicepresidente', salary_amount: 75000 },
    { role_id: '1466248918294593586', role_name: 'Secretario de economia', salary_amount: 50000 },
    { role_id: '1466248809196818474', role_name: 'Secretario de defensa', salary_amount: 50000 },
    { role_id: '1466249013891305544', role_name: 'Secretario ambiental', salary_amount: 50000 },
    { role_id: '1466249089447497984', role_name: 'Secretario de salud', salary_amount: 50000 }
];

async function addSalaries() {
    console.log('💰 Agregando sueldos de gobierno...');

    for (const salary of SALARIES) {
        salary.guild_id = guildId;

        const { data, error } = await supabase
            .from('job_salaries')
            .upsert(salary, { onConflict: 'guild_id, role_id' })
            .select();

        if (error) {
            console.error(`❌ Error al agregar ${salary.role_name}:`, error.message);
        } else {
            console.log(`✅ ${salary.role_name}: $${salary.salary_amount.toLocaleString()}`);
        }
    }
}

addSalaries();
