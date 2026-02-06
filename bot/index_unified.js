const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '.env')) ? path.join(__dirname, '.env') : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const logger = require('./services/Logger');
const SingleInstanceLock = require('./services/SingleInstanceLock');

// --- BOT INSTANCES ---
// --- BOT INSTANCES ---
let startModerationBot, startEconomyBot, startGovernmentBot, startDealershipBot;

try {
    console.log("Loading Moderation Bot...");
    startModerationBot = require('./instances/moderation');
} catch (e) { console.error('❌ CRITICAL: Failed to load MODERATION module:', e); }

try {
    console.log("Loading Economy Bot...");
    startEconomyBot = require('./instances/economy');
} catch (e) { console.error('❌ CRITICAL: Failed to load ECONOMY module:', e); }

try {
    console.log("Loading Government Bot...");
    startGovernmentBot = require('./instances/government');
} catch (e) { console.error('❌ CRITICAL: Failed to load GOVERNMENT module:', e); }

try {
    console.log("Loading Dealership Bot...");
    startDealershipBot = require('./instances/dealership');
} catch (e) { console.error('❌ CRITICAL: Failed to load DEALERSHIP module:', e); }

// --- LOGGING ---
logger.info('Starting Nacion MX Unified System');
const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
logger.info(`Instance ID: ${INSTANCE_ID}`);

// --- DATABASE ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    logger.error('CRITICAL: Supabase credentials missing (.env)');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => logger.errorWithContext('Uncaught Exception', err, { source: 'global' }));
process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection', { reason }));

// --- HEALTH CHECK SERVER ---
const app = express();
app.use(express.json()); // Parse JSON request bodies
const port = process.env.PORT || 8000;

// --- API ROUTES ---
const applicationsRouter = require('./routes/applications');
// Note: We'll pass client after bots are initialized
let moderationClient = null;

app.get('/', (req, res) => {
    res.status(200).send(`
        <h1>🤖 Nacion MX Unified System</h1>
        <p>✅ All Systems Operational</p>
        <p>🕒 Time: ${new Date().toISOString()}</p>
        <p>🆔 Instance: ${INSTANCE_ID}</p>
    `);
});

app.listen(port, '0.0.0.0', () => logger.info('🌐', `Health Server listening on port ${port}`));

// =============================================================================
// 🚀 LAUNCH SEQUENCE
// =============================================================================
(async () => {
    try {
        console.log("🔍 [DEBUG] Starting Launch Sequence...");

        // ENV CHECK PROBE
        console.log("🔍 [DEBUG] Checking Environment Variables...");
        const vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_TOKEN_MOD', 'DISCORD_TOKEN_ECO', 'DISCORD_TOKEN_GOV', 'DISCORD_TOKEN_DEALERSHIP'];
        vars.forEach(v => {
            const exists = !!process.env[v];
            console.log(`   - ${v}: ${exists ? '✅ Present' : '❌ MISSING'} (${exists ? (process.env[v].substring(0, 5) + '...') : 'N/A'})`);
        });

        // LOCK ACQUISITION
        const locker = new SingleInstanceLock(supabase, INSTANCE_ID);
        let acquired = await locker.acquireLock();
        let attempts = 0;
        const MAX_ATTEMPTS = 9;

        if (!acquired) {
            logger.info('Another instance active, waiting for lock...');
            while (!acquired && attempts < MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                acquired = await locker.acquireLock();
                attempts++;
                if (acquired) break;
            }
            if (!acquired) logger.warn(`⚠️ Lock timeout. Force starting...`);
        }

        console.log("🚀 [Startup] Launching bot instances...");

        // Start Bots in Parallel and store references
        const [modClient] = await Promise.all([
            startModerationBot(supabase).catch(e => console.error("❌ [MOD] Failed:", e)),
            startEconomyBot(supabase).catch(e => console.error("❌ [ECO] Failed:", e)),
            startGovernmentBot(supabase).catch(e => console.error("❌ [GOV] Failed:", e)),
            startDealershipBot(supabase).catch(e => console.error("❌ [DEALERSHIP] Failed:", e)) // [NEW]
        ]);

        moderationClient = modClient;

        // Register API routes (now that we have client)
        if (moderationClient) {
            app.use('/api', applicationsRouter(moderationClient, supabase));
            logger.info('✅', 'Applications API routes registered');
        }

        logger.info('🚀', 'System Fully Operational');

        // SHUTDOWN HANDLER
        const handleShutdown = async (signal) => {
            console.log(`🛑 [${signal}] Releasing lock...`);
            await locker.releaseLock();
            process.exit(0);
        };

        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));

    } catch (error) {
        console.error('💥 FATAL CRASH:', error, error.stack);
    }
})();
