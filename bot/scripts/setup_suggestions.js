require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createTable() {
    console.log('📦 Creating/Verifying suggestions table...');

    // SQL to create the table
    // Note: We use raw SQL normally, but Supabase JS doesn't support table creation natively without RPC or Dashboard.
    // However, since we are in "Agent" mode, I'll use the 'rpc' workaround if a function exists, 
    // OR more reliably, I'll instruct the user to do it if I fail, BUT 
    // I can try to INSERT and see if it fails, or assume the user has a setup flow.
    // WAIT: I can use the 'rpc' 'exec_sql' if it exists. 

    // BETTER APPROACH: Just assume I can't create tables via standard API unless I have the service key and use specific restricted capabilities.
    // BUT, usually I just provide the SQL for the user OR I try to use my existing connection if I have a postgres connection string.

    // HACK: I will just use the Supabase 'rpc' if the user has 'run_sql' function set up (common in these projects).
    // If not, I'll use a direct PG connection if possible? No/

    // Alternative: I'll assume the user has the table, OR I will try to use the 'tickets' table logic as a template.
    // Actually, I will Create a file that the user can execute if they have direct access, OR I'll assume I need to guide them.

    // Wait, the previous bot code uses Supabase strictly as an API. 
    // I will try to use `rpc` "create_suggestions_table" if I can, or fail gracefully.

    // NOTE: For this specific user env, I'll create a script that they *could* run if they had the `sql` capabilities, 
    // but likely I have to rely on the dashboard. 
    // HOWEVER, I can try to use standard INSERT to see if it exists.

    const { error } = await supabase.from('suggestions').select('count', { count: 'exact', head: true });

    if (error && error.code === '42P01') { // Undefined table
        console.error('❌ Table `suggestions` does not exist!');
        console.log('\n⚠️ PLEASE RUN THIS SQL IN SUPABASE DASHBOARD -> SQL EDITOR:\n');
        console.log(`
CREATE TABLE IF NOT EXISTS public.suggestions (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    upvotes JSONB DEFAULT '[]'::jsonb,
    downvotes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON public.suggestions(user_id);
        `);
    } else if (error) {
        console.error('Error checking table:', error);
    } else {
        console.log('✅ Table `suggestions` already exists.');
    }
}

createTable();
