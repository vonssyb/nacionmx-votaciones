const oracleClient = require('../lib/oracle');

console.log('🧪 Testing Oracle Cloud Connection...\n');

async function testConnection() {
    try {
        console.log('1️⃣ Inicializando cliente Oracle...');
        await oracleClient.init();
        console.log('   ✅ Cliente inicializado\n');

        // Test 1: Simple SELECT
        console.log('2️⃣ Test SELECT simple...');
        const result1 = await oracleClient.execute('SELECT 1 + 1 AS result FROM DUAL');
        console.log(`   ✅ Query ejecutada: ${result1.rows[0].RESULT}\n`);

        // Test 2: Count de tablas
        console.log('3️⃣ Test COUNT en tabla citizens...');
        const result2 = await oracleClient.execute('SELECT COUNT(*) AS total FROM citizens');
        console.log(`   ✅ Total citizens: ${result2.rows[0].TOTAL}\n`);

        // Test 3: SELECT con datos
        console.log('4️⃣ Test SELECT con datos...');
        const result3 = await oracleClient.execute(
            'SELECT * FROM citizens WHERE ROWNUM <= 5'
        );
        console.log(`   ✅ Encontrados: ${result3.rows.length} rows`);
        if (result3.rows.length > 0) {
            console.log(`   📋 Primera fila:`, result3.rows[0]);
        }
        console.log();

        // Test 4: INSERT test
        console

            .log('5️⃣ Test INSERT...');
        const testData = {
            instance_id: `test_${Date.now()}`,
            last_heartbeat: new Date(),
            status: 'testing'
        };

        await oracleClient.execute(
            'INSERT INTO bot_heartbeats (instance_id, last_heartbeat, status) VALUES (:1, :2, :3)',
            [testData.instance_id, testData.last_heartbeat, testData.status]
        );
        console.log('   ✅ INSERT exitoso\n');

        // Test 5: Verificar INSERT
        console.log('6️⃣ Test SELECT del INSERT...');
        const result4 = await oracleClient.execute(
            'SELECT * FROM bot_heartbeats WHERE instance_id = :1',
            [testData.instance_id]
        );
        console.log(`   ✅ Row encontrado:`, result4.rows[0]);
        console.log();

        // Test 6: UPDATE
        console.log('7️⃣ Test UPDATE...');
        await oracleClient.execute(
            'UPDATE bot_heartbeats SET status = :1 WHERE instance_id = :2',
            ['updated', testData.instance_id]
        );
        console.log('   ✅ UPDATE exitoso\n');

        // Test 7: DELETE
        console.log('8️⃣ Test DELETE...');
        await oracleClient.execute(
            'DELETE FROM bot_heartbeats WHERE instance_id = :1',
            [testData.instance_id]
        );
        console.log('   ✅ DELETE exitoso\n');

        // Test 8: Wrapper de cliente
        console.log('9️⃣ Test wrapper from()...');
        const table = await oracleClient.from('debit_cards');
        const { data } = await table.selectWhere('*', 'ROWNUM <= 3', []);
        console.log(`   ✅ Wrapper funciona: ${data.length} rows\n`);

        console.log('═══════════════════════════════════════════════');
        console.log('✅ TODOS LOS TESTS PASARON');
        console.log('═══════════════════════════════════════════════\n');
        console.log('🎉 Tu conexión a Oracle Cloud funciona perfectamente!');
        console.log('💡 Ahora puedes empezar a usar el bot con Oracle\n');

    } catch (err) {
        console.error('\n❌ ERROR EN TESTS:', err);
        console.error('\n🔍 Posibles causas:');
        console.error('   1. Wallet no encontrado o incorrecto');
        console.error('   2. Credenciales incorrectas en .env');
        console.error('   3. Database no accesible');
        console.error('   4. Tablas no creadas todavía\n');
    } finally {
        await oracleClient.close();
    }
}

testConnection();
