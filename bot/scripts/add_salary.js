const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const guildId = process.env.GUILD_ID || '1398525215134318713'; // Fallback to ID found in SQL

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Falta configuración de SUPABASE en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NEW_SALARY = {
    guild_id: guildId,
    role_id: '1458505462768079092',
    role_name: 'Gasolinero',
    salary_amount: 2500 // Similar a Reportero/Basurero
};

async function addSalary() {
    console.log(`💰 Agregando sueldo para: ${NEW_SALARY.role_name} (ID: ${NEW_SALARY.role_id})`);

    // Upsert allows updating if it already exists
    const { data, error } = await supabase
        .from('job_salaries')
        .upsert(NEW_SALARY, { onConflict: 'guild_id, role_id' })
        .select();

    if (error) {
        console.error('❌ Error al agregar sueldo:', error);
    } else {
        console.log('✅ Sueldo agregado exitosamente:', data);
    }
}

addSalary();
