require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Falta SUPABASE_URL o SUPABASE_KEY (o SERVICE_ROLE) en el archivo .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncCensus() {
    console.log('🔄 Iniciando sincronización del Censo (DNI -> Citizens)...');

    // 1. Get all verified IDs (DNIs)
    const { data: allDnis, error: dniError } = await supabase
        .from('citizen_dni')
        .select('*');

    if (dniError) {
        console.error('❌ Error obteniendo DNIs:', dniError);
        return;
    }

    console.log(`📊 Total de DNIs encontrados: ${allDnis.length}`);

    let syncedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const dni of allDnis) {
        // 2. Check if exists in 'citizens'
        const { data: existingCitizen } = await supabase
            .from('citizens')
            .select('id')
            .eq('discord_id', dni.user_id)
            .maybeSingle();

        if (existingCitizen) {
            skippedCount++;
            continue;
        }

        // 3. Create missing citizen record
        const fullName = `${dni.nombre} ${dni.apellido}`;
        console.log(`➕ Creando registro para: ${fullName} (${dni.user_id})`);

        const { error: insertError } = await supabase
            .from('citizens')
            .insert([{
                discord_id: dni.user_id,
                full_name: fullName,
                dni: dni.foto_url || '',
                credit_score: 100
            }]);

        if (insertError) {
            console.error(`❌ Error creando usuario ${dni.user_id}:`, insertError.message);
            errorCount++;
        } else {
            syncedCount++;
        }
    }

    console.log('\n✅ Sincronización Completada');
    console.log(`🆕 Registros creados/reparados: ${syncedCount}`);
    console.log(`⏭️ Ya existían: ${skippedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
}

syncCensus();
