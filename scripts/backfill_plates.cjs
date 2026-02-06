const { createClient } = require('../bot/node_modules/@supabase/supabase-js');
require('../bot/node_modules/dotenv').config({ path: './.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Credenciales de Supabase no encontradas.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generatePlate() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    let plate = '';
    for (let i = 0; i < 3; i++) plate += letters.charAt(Math.floor(Math.random() * letters.length));
    plate += '-';
    for (let i = 0; i < 3; i++) plate += numbers.charAt(Math.floor(Math.random() * numbers.length));

    return plate;
}

async function backfillPlates() {
    console.log('🚗 Iniciando backfill de placas...');

    // 1. Get vehicles without plates
    const { data: vehicles, error } = await supabase
        .from('dealership_sales')
        .select('id, user_id')
        .is('plate', null);

    if (error) {
        console.error('❌ Error obteniendo vehículos:', error);
        if (error.code === '42703') {
            console.error('⚠️ ALERTA: La columna "plate" no existe. Debes ejecutar la migración "bot/migrations/add_security_fields.sql" primero.');
        }
        return;
    }

    if (!vehicles || vehicles.length === 0) {
        console.log('✅ No hay vehículos sin placa.');
        return;
    }

    console.log(`📝 Procesando ${vehicles.length} vehículos...`);

    let updated = 0;
    for (const vehicle of vehicles) {
        let plate = generatePlate();

        // Simple update without uniqueness check loop for speed (collisions rare in small batches)
        // In prod, would check existence.

        const { error: updateError } = await supabase
            .from('dealership_sales')
            .update({ plate: plate })
            .eq('id', vehicle.id);

        if (!updateError) {
            console.log(`✅ Vehículo ID ${vehicle.id} -> [${plate}]`);
            updated++;
        } else {
            console.error(`Error actualizando vehículo ${vehicle.id}:`, updateError.message);
        }
    }

    console.log(`\n🎉 Completado. ${updated} vehículos actualizados con placas.`);
    process.exit(0);
}

backfillPlates();
