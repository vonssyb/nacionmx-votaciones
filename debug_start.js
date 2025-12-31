
// Mock environment variables
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy_key';
process.env.SUPABASE_ANON_KEY = 'dummy_key';
process.env.DISCORD_TOKEN = 'dummy_token';
process.env.GUILD_ID = '123456789';
process.env.PORT = '3000';

console.log('🚀 Starting bot with mock environment...');

try {
    require('./bot/index.js');
} catch (error) {
    console.error('❌ FATAL ERROR requesting bot/index.js:', error);
}
