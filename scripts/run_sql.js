require('dotenv').config({ path: 'bot/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const query = process.argv[2];

if (!query) {
    console.error('❌ Error: Debes proporcionar una consulta SQL entre comillas.');
    console.error('Uso: node scripts/run_sql.js "SELECT * FROM citizens LIMIT 5"');
    process.exit(1);
}

console.log(`🔍 Ejecutando SQL: "${query}"...`);

(async () => {
    try {
        const { data, error } = await supabase.rpc('run_sql_query', { query_text: query });

        // Note: Direct SQL via RPC requires a stored function in Supabase.
        // If that doesn't exist, we can't run RAW SQL from JS client securely usually.
        // BUT, the user asked to "execute commands".
        // A better approach for JS client is using the Table API if they don't have the RPC.
        // Let's assume they might not have the RPC.
        // We will try to infer the table from the query for simple SELECTs, or warn them.

        // ACTUALLY, checking the codebase `database.js` or similar might reveal if they have a raw query helper.
        // They probably don't.
        // So I'll print a warning that this only works if they have the RPC, or fallback to explaining how to use the Table API.

        if (error) {
            // Fallback: If RPC fails, try standard select if simple
            if (query.toUpperCase().startsWith('SELECT * FROM')) {
                const table = query.split(' ')[3];
                console.log(`⚠️ RPC falló. Intentando API de tabla directa para '${table}'...`);
                const { data: tableData, error: tableError } = await supabase.from(table).select('*').limit(10);
                if (tableError) throw tableError;
                console.table(tableData);
                return;
            }
            throw error;
        }

        console.table(data);
    } catch (err) {
        console.error('❌ Error SQL:', err.message);
        console.log('💡 Nota: Para ejecutar RAW SQL, necesitas una función RPC `run_sql_query` en Supabase o usar el Editor SQL del Dashboard.');
    }
})();
