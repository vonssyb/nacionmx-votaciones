require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { handleModerationLegacy } = require('./handlers/legacyModerationHandler');

// --- LOGGING ---
const log = (prefix, msg) => console.log(`${prefix} ${msg}`);

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SHARED WEB SERVER (Health Check) ---
const app = express();
const port = process.env.PORT || 8000;

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Nacion MX Unified System</h1>
        <p>✅ Moderation Bot: Online</p>
        <p>✅ Economy Bot: Online</p>
        <p>✅ Government Bot: Online</p>
    `);
});

app.listen(port, () => {
    log('🌐', `Unified Server listening on port ${port}`);
});

// =============================================================================
// HELPER: SAFE DEFER
// =============================================================================
async function safeDefer(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
            // PATCH: Prevent double defer
            interaction.deferReply = async () => { };
            return true;
        }
        return true; // Already deferred/replied is considered "safe"
    } catch (e) {
        if (e.code === 10062 || e.message === 'Unknown interaction') {
            // Silently ignore "Unknown interaction" (Race condition or Timeout)
            return false;
        }
        console.error(`[Wrapper] Defer Failed (${interaction.commandName || 'component'}):`, e);
        return false;
    }
}

// =============================================================================
// 👮‍♂️ MODERATION BOT SETUP
// =============================================================================
async function startModerationBot() {
    log('👮‍♂️', 'Starting Moderation Bot...');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Services
    const SanctionService = require('./services/SanctionService');
    const BillingService = require('./services/BillingService');
    const DailyMissionManager = require('./services/DailyMissionManager');
    const CasinoService = require('./services/CasinoService');
    const StockService = require('./services/StockService');

    const sanctionService = new SanctionService(supabase);
    client.missionManager = new DailyMissionManager(supabase);
    client.services = {
        sanctions: sanctionService,
        billing: new BillingService(client, supabase),
        casino: new CasinoService(supabase),
        stocks: new StockService(supabase)
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['moderation', 'utils']);

    // Events
    client.once('ready', () => {
        log('🟢', `[MOD] Logged in as ${client.user.tag}`);
    });

    // Interaction Handler
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) {
            try {
                // FALLBACK TO LEGACY (Handles Buttons, Modals, Menus)
                await handleModerationLegacy(interaction, client, client.supabase);
            } catch (e) {
                console.error('[MOD] Legacy Handler Error:', e);
            }
            return;
        }

        // GLOBAL SAFE DEFER
        if (!await safeDefer(interaction)) return;

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try {
                await command.execute(interaction, client, supabase);
            } catch (e) {
                console.error('[MOD] Command Error:', e);
                const msg = '❌ Error fatal ejecutando el comando.';
                if (interaction.replied || interaction.deferred) await interaction.editReply(msg).catch(() => { });
                else await interaction.reply({ content: msg, ephemeral: true }).catch(() => { });
            }
        }
    });

    // Login with Retry
    const TOKEN = process.env.DISCORD_TOKEN_MOD;
    if (!TOKEN) return log('❌', '[MOD] No Token Found');

    loginWithRetry(client, TOKEN, 'MOD');
}

// =============================================================================
// 💰 ECONOMY BOT SETUP
// =============================================================================
async function startEconomyBot() {
    log('💰', 'Starting Economy Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Services
    const LevelService = require('./services/LevelService');
    const MissionService = require('./services/MissionService');
    const AchievementService = require('./services/AchievementService');
    const StoreService = require('./services/StoreService');
    const BillingService = require('./services/BillingService');
    const TaxService = require('./services/TaxService');
    const CompanyService = require('./services/CompanyService');
    const StakingService = require('./services/StakingService');
    const SlotsService = require('./services/SlotsService');

    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const storeService = new StoreService(supabase);

    // Billing Service (Safe Instantiation)
    let billingService;
    try { billingService = new BillingService(client, supabase); } catch (e) { console.error('Eco Billing Error:', e); }

    // Services
    const CasinoService = require('./services/CasinoService');
    const StockService = require('./services/StockService');

    const casinoService = new CasinoService(supabase);
    const stockService = new StockService(supabase);

    client.services = {
        billing: billingService,
        tax: new TaxService(supabase),
        company: new CompanyService(supabase),
        staking: new StakingService(supabase),
        slots: new SlotsService(supabase),
        levels: levelService,
        achievements: achievementService,
        missions: missionService,
        store: storeService,
        casino: casinoService,
        stocks: stockService
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games', 'utils']);

    // Legacy Support
    const { handleEconomyLegacy } = require('./handlers/legacyEconomyHandler');
    client.legacyHandler = handleEconomyLegacy;

    // Events
    client.once('ready', () => {
        log('🟢', `[ECO] Logged in as ${client.user.tag}`);
    });

    client.on('interactionCreate', async interaction => {
        // Handle Buttons
        if (interaction.isButton() && interaction.customId.startsWith('buy_item_')) {
            await client.services.store.handleBuyButton(interaction);
            return;
        }
        // Handle Commands
        if (interaction.isChatInputCommand()) {
            if (!await safeDefer(interaction)) return;
        }

        const command = interaction.isChatInputCommand() ? client.commands.get(interaction.commandName) : null;
        if (command) {
            try { await command.execute(interaction, client, supabase); } catch (e) {
                console.error('[ECO] Command Error:', e);
                await interaction.editReply('❌ Error ejecutando comando.').catch(() => { });
            }
        } else if (client.legacyHandler) {
            // FALLBACK TO LEGACY (Handles Buttons, Modals, Menus not caught above)
            try { await client.legacyHandler(interaction, client, supabase); } catch (e) {
                console.error('[ECO] Legacy Error:', e);
                // Don't reply here as legacy handler might have handled it or it's an unrelated interaction
            }
        }
    });

    // Login
    const TOKEN = process.env.DISCORD_TOKEN_ECO;
    if (!TOKEN) return log('❌', '[ECO] No Token Found');

    loginWithRetry(client, TOKEN, 'ECO');
}

// =============================================================================
// 🏛️ GOVERNMENT BOT SETUP
// =============================================================================
async function startGovernmentBot() {
    log('🏛️', 'Starting Government Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Services
    const LevelService = require('./services/LevelService');
    const MissionService = require('./services/MissionService');
    const AchievementService = require('./services/AchievementService');
    const BillingService = require('./services/BillingService');
    const ExchangeService = require('./services/ExchangeService');

    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const billingService = new BillingService(client, supabase);
    const exchangeService = new ExchangeService(supabase, billingService.ubService);

    client.services = {
        levels: levelService,
        missions: missionService,
        achievements: achievementService,
        billing: billingService,
        exchange: exchangeService
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['gov', 'utils']);

    // Events
    client.once('ready', () => {
        log('🟢', `[GOV] Logged in as ${client.user.tag}`);
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;

        // GLOBAL SAFE DEFER
        if (!await safeDefer(interaction)) return;

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try { await command.execute(interaction, client, supabase); } catch (e) {
                console.error('[GOV] Command Error:', e);
                await interaction.editReply('❌ Error ejecutando comando.').catch(() => { });
            }
        }
    });

    // Login
    const TOKEN = process.env.DISCORD_TOKEN_GOV;
    if (!TOKEN) return log('❌', '[GOV] No Token Found');

    loginWithRetry(client, TOKEN, 'GOV');
}

// =============================================================================
// HELPER: ROBUST LOGIN
// =============================================================================
async function loginWithRetry(client, token, botName) {
    try {
        await client.login(token);
    } catch (error) {
        console.error(`❌ [${botName}] Login Failed:`, error.message);
        setTimeout(() => loginWithRetry(client, token, botName), 10000);
    }
}

// =============================================================================
// 🚀 LAUNCH ALL
// =============================================================================
(async () => {
    try {
        await startModerationBot();
        await startEconomyBot();
        await startGovernmentBot();
        log('🚀', 'All Initialization Functions Called');
    } catch (error) {
        console.error('💥 FATAL UNIFIED CRASH:', error);
    }
})();
