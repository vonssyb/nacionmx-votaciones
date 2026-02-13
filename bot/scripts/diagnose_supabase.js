const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnoseSupabase() {
    console.log('🔍 Diagnóstico de Supabase\n');
    console.log('📡 URL:', SUPABASE_URL);
    console.log('⏰ Hora:', new Date().toISOString(), '\n');

    const results = {
        connectionTest: null,
        simpleQuery: null,
        complexQuery: null,
        tableCount: null,
        recentActivity: null
    };

    // 1. Test de conexión básica
    console.log('1️⃣ Probando conexión básica...');
    const connectionStart = Date.now();
    try {
        const { data, error } = await supabase
            .from('bot_heartbeats')
            .select('id')
            .limit(1);

        const connectionTime = Date.now() - connectionStart;

        if (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.connectionTest = { success: false, error: error.message, time: connectionTime };
        } else {
            console.log(`   ✅ Conexión exitosa (${connectionTime}ms)`);
            results.connectionTest = { success: true, time: connectionTime };
        }
    } catch (err) {
        const connectionTime = Date.now() - connectionStart;
        console.log(`   ❌ Excepción: ${err.message}`);
        results.connectionTest = { success: false, error: err.message, time: connectionTime };
    }

    // 2. Query simple con count
    console.log('\n2️⃣ Probando query simple (count)...');
    const simpleStart = Date.now();
    try {
        const { count, error } = await supabase
            .from('citizens')
            .select('*', { count: 'exact', head: true });

        const simpleTime = Date.now() - simpleStart;

        if (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.simpleQuery = { success: false, error: error.message, time: simpleTime };
        } else {
            console.log(`   ✅ Total ciudadanos: ${count} (${simpleTime}ms)`);
            results.simpleQuery = { success: true, count, time: simpleTime };
        }
    } catch (err) {
        const simpleTime = Date.now() - simpleStart;
        console.log(`   ❌ Excepción: ${err.message}`);
        results.simpleQuery = { success: false, error: err.message, time: simpleTime };
    }

    // 3. Query compleja con JOIN
    console.log('\n3️⃣ Probando query compleja (JOIN)...');
    const complexStart = Date.now();
    try {
        const { data, error } = await supabase
            .from('debit_cards')
            .select('card_number, balance, citizens!inner(full_name)')
            .limit(5);

        const complexTime = Date.now() - complexStart;

        if (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.complexQuery = { success: false, error: error.message, time: complexTime };
        } else {
            console.log(`   ✅ Query ejecutada: ${data.length} resultados (${complexTime}ms)`);
            results.complexQuery = { success: true, count: data.length, time: complexTime };
        }
    } catch (err) {
        const complexTime = Date.now() - complexStart;
        console.log(`   ❌ Excepción: ${err.message}`);
        results.complexQuery = { success: false, error: err.message, time: complexTime };
    }

    // 4. Verificar número de tablas
    console.log('\n4️⃣ Verificando estructura de BD...');
    const tableStart = Date.now();
    try {
        // Lista de tablas conocidas
        const tables = [
            'bot_heartbeats',
            'citizens',
            'debit_cards',
            'credit_cards',
            'companies',
            'tax_evasion_history',
            'user_purchases',
            'casino_chips'
        ];

        let existingTables = 0;
        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (!error) existingTables++;
        }

        const tableTime = Date.now() - tableStart;
        console.log(`   ✅ Tablas verificadas: ${existingTables}/${tables.length} (${tableTime}ms)`);
        results.tableCount = { success: true, existing: existingTables, total: tables.length, time: tableTime };
    } catch (err) {
        const tableTime = Date.now() - tableStart;
        console.log(`   ❌ Excepción: ${err.message}`);
        results.tableCount = { success: false, error: err.message, time: tableTime };
    }

    // 5. Actividad reciente (heartbeats)
    console.log('\n5️⃣ Verificando actividad reciente...');
    const activityStart = Date.now();
    try {
        const { data, error } = await supabase
            .from('bot_heartbeats')
            .select('instance_id, last_heartbeat')
            .order('last_heartbeat', { ascending: false })
            .limit(5);

        const activityTime = Date.now() - activityStart;

        if (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.recentActivity = { success: false, error: error.message, time: activityTime };
        } else {
            console.log(`   ✅ Heartbeats encontrados: ${data.length}`);
            if (data.length > 0) {
                const latest = new Date(data[0].last_heartbeat);
                const now = new Date();
                const diff = Math.floor((now - latest) / 1000);
                console.log(`   📅 Último heartbeat: ${diff}s ago (${activityTime}ms)`);
            }
            results.recentActivity = { success: true, count: data.length, time: activityTime };
        }
    } catch (err) {
        const activityTime = Date.now() - activityStart;
        console.log(`   ❌ Excepción: ${err.message}`);
        results.recentActivity = { success: false, error: err.message, time: activityTime };
    }

    // Resumen
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 RESUMEN DE DIAGNÓSTICO');
    console.log('═══════════════════════════════════════════════\n');

    const avgTime = Object.values(results)
        .filter(r => r && r.time)
        .reduce((sum, r) => sum + r.time, 0) / Object.values(results).filter(r => r && r.time).length;

    console.log(`⏱️  Tiempo promedio de queries: ${Math.round(avgTime)}ms`);

    if (avgTime < 100) {
        console.log('✅ Rendimiento: EXCELENTE');
    } else if (avgTime < 500) {
        console.log('⚠️  Rendimiento: ACEPTABLE (puede mejorar)');
    } else if (avgTime < 2000) {
        console.log('🐌 Rendimiento: LENTO (revisar)');
    } else {
        console.log('🚨 Rendimiento: MUY LENTO (problema crítico)');
    }

    // Recomendaciones
    console.log('\n📋 RECOMENDACIONES:\n');

    if (avgTime > 500) {
        console.log('1. ⚠️  Base de datos respondiendo lentamente');
        console.log('   → Verifica el plan de Supabase (free tier tiene límites)');
        console.log('   → Considera upgrading a un plan pago para mejor performance');
    }

    if (results.connectionTest?.time > 1000) {
        console.log('2. 🌐 Latencia de red alta');
        console.log('   → Verifica tu conexión a internet');
        console.log('   → Considera cambiar región de Supabase si es posible');
    }

    if (results.complexQuery?.time > results.simpleQuery?.time * 5) {
        console.log('3. 🔗 Queries complejas mucho más lentas');
        console.log('   → Revisa índices en tablas con JOINs');
        console.log('   → Considera optimizar queries frecuentes');
    }

    console.log('\n4. 💡 Para mejorar velocidad:');
    console.log('   → Implementar caché en memoria para datos frecuentes');
    console.log('   → Usar pooling de conexiones (ya configurado)');
    console.log('   → Limitar queries grandes con .limit()');
    console.log('   → Considerar upgrade de Supabase plan');
}

diagnoseSupabase().catch(console.error);
