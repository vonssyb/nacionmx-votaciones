require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { handleModerationLegacy } = require('./handlers/legacyModerationHandler');

// --- LOGGING ---
const log = (prefix, msg) => console.log(`${prefix} ${msg}`);

// --- CONFIGURATION ---
const INSTANCE_ID = Math.random().toString(36).substring(7).toUpperCase();
console.log(`🆔 BOT INSTANCE STARTED: ${INSTANCE_ID}`);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- GLOBAL ERROR HANDLERS (Prevent Exit Code 1) ---
process.on('uncaughtException', (err) => {
    console.error('💥 [CRASH PREVENTION] Uncaught Exception:', err);
    // Keep process alive if possible, but log critical error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [CRASH PREVENTION] Unhandled Rejection at:', promise, 'reason:', reason);
});

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
    const ErlcPollingService = require('./services/ErlcPollingService');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates // REQUIRED for voice
        ]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // --- AUDIT LOGGING ---
    client.logAudit = async (action, details, moderator, target, color = 0x00AAFF, files = [], channelId = null) => {
        try {
            const AUDIT_CHANNEL_ID = channelId || '1456035521141670066'; // Security/Sanctions (Default)
            const channel = await client.channels.fetch(AUDIT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setTitle(`🛡️ Auditoría: ${action}`)
                    .setColor(color)
                    .addFields(
                        { name: '👮 Staff', value: `${moderator.tag} (<@${moderator.id}>)`, inline: true },
                        { name: '👤 Usuario', value: target ? `${target.tag} (<@${target.id}>)` : 'N/A', inline: true },
                        { name: '📝 Detalles', value: details.length > 1020 ? details.substring(0, 1020) + '...' : details }
                    )
                    .setTimestamp();
                await channel.send({ embeds: [embed], files: files });
            }
        } catch (error) {
            console.error('[MOD] Audit Log Error:', error);
        }
    };

    // Services
    const SanctionService = require('./services/SanctionService');
    const BillingService = require('./services/BillingService');
    const DailyMissionManager = require('./services/DailyMissionManager');
    const CasinoService = require('./services/CasinoService');
    const StockService = require('./services/StockService');

    const sanctionService = new SanctionService(supabase);
    client.missionManager = new DailyMissionManager(supabase);

    // ERLC Scheduler (Offline Queue)
    const ErlcScheduler = require('./services/ErlcScheduler');
    const erlcScheduler = new ErlcScheduler(supabase, process.env.ERLC_API_KEY || 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp');
    erlcScheduler.start(3000000); // Check every 50 minutes (requested by user)

    // ERLC Service & Log Manager (Adaptive Polling)
    const ErlcService = require('./services/ErlcService');
    const erlcService = new ErlcService(process.env.ERLC_API_KEY || 'ARuRfmzZGTqbqUCjMERA-dzEeGLbRfisfjKtiCOXLHATXDedYZsQQEethQMZp');

    // Log Channel ID from legacy code: 1457892493310951444
    // ERLC Log Manager (General Logs to Channel)
    const ErlcLogManager = require('./services/ErlcLogManager');
    const erlcLogManager = new ErlcLogManager(client, supabase, erlcService, '1457892493310951444');
    erlcLogManager.start();

    // ERLC Command Poller (Voice Swarm Enabler)
    const VoiceSwarmService = require('./services/VoiceSwarmService');
    const swarmTokens = process.env.VOICE_SWARM_TOKENS ? process.env.VOICE_SWARM_TOKENS.split(',') : [];

    // Initialize Swarm
    const swarmService = new VoiceSwarmService(swarmTokens);
    swarmService.init().catch(err => console.error('❌ [Swarm] Init Failed:', err));

    const erlcPollingService = new ErlcPollingService(supabase, client, swarmService);
    erlcPollingService.start();

    client.services = {
        sanctions: sanctionService,
        billing: new BillingService(client, supabase),
        casino: new CasinoService(supabase),
        stocks: new StockService(supabase),
        erlcScheduler: erlcScheduler,
        erlc: erlcService,
        erlcLogManager: erlcLogManager,
        erlcPolling: erlcPollingService,
        swarm: swarmService
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['moderation', 'utils', 'owner']);

    // Events
    client.once('ready', () => {
        log('🟢', `[MOD] Logged in as ${client.user.tag}`);
    });



    // --- ENHANCED LOGGING ---
    const LOG_CHANNEL_ID = '1457457209268109516'; // Canal de Logs General

    client.on('messageDelete', async message => {
        if (!message.guild || message.author?.bot) return;

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
            const files = [];

            // Handle Attachments (Re-upload)
            if (message.attachments.size > 0) {
                message.attachments.forEach(att => {
                    // Try using proxyURL as it lasts slightly longer, or url
                    files.push(new AttachmentBuilder(att.proxyURL || att.url, { name: att.name }));
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🗑️ Mensaje Eliminado [${INSTANCE_ID}]`)
                .setColor('#FF0000')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .addFields(
                    { name: 'Autor', value: `<@${message.author.id}>`, inline: true },
                    { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Contenido', value: message.content ? message.content.substring(0, 1024) : '*(Sin contenido de texto)*' }
                )
                .setFooter({ text: `ID: ${message.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed], files: files });

        } catch (err) {
            console.error('[MOD] Error logging delete:', err);
        }
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignore embed updates

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const { EmbedBuilder } = require('discord.js');

            const embed = new EmbedBuilder()
                .setTitle(`✏️ Mensaje Editado [${INSTANCE_ID}]`)
                .setColor('#FFA500')
                .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
                .setDescription(`[Ir al mensaje](${newMessage.url})`)
                .addFields(
                    { name: 'Autor', value: `<@${oldMessage.author.id}>`, inline: true },
                    { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
                    { name: 'Antes', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*(Vacío)*' },
                    { name: 'Después', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*(Vacío)*' }
                )
                .setFooter({ text: `ID: ${newMessage.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });

        } catch (err) {
            console.error('[MOD] Error logging update:', err);
        }
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

    // Exchange Rate Service
    const ExchangeRateService = require('./services/ExchangeRateService');

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
        stocks: stockService,
        exchangeRate: new ExchangeRateService(supabase)
    };

    // Load Commands
    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games']);

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
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['gov']);

    // AUTO-REGISTER COMMANDS (On Startup)
    const GOV_TOKEN = process.env.DISCORD_TOKEN_GOV;
    const GOV_GUILD_ID = process.env.GUILD_ID;

    if (GOV_TOKEN && GOV_GUILD_ID) {
        try {
            console.log('🔄 Auto-registering Gov commands...');
            const rest = new REST({ version: '10' }).setToken(GOV_TOKEN);
            const currentUser = await rest.get(Routes.user('@me'));
            const clientId = currentUser.id;

            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            await rest.put(
                Routes.applicationGuildCommands(clientId, GOV_GUILD_ID),
                { body: allCommands }
            );
            console.log(`✅ Registered ${allCommands.length} Gov commands via REST.`);
        } catch (regError) {
            console.error('❌ Auto-registration failed:', regError);
        }
    }

    // Events
    client.once('ready', () => {
        log('🟢', `[GOV] Logged in as ${client.user.tag}`);
    });

    client.on('interactionCreate', async interaction => {
        // Handle button interactions
        if (interaction.isButton() && interaction.customId.startsWith('visa_pay_')) {
            const visaPaymentHandler = require('./handlers/visaPaymentHandler');
            try {
                await visaPaymentHandler.execute(interaction, client, interaction.customId);
            } catch (error) {
                console.error('[GOV] Visa Payment Error:', error);
                await interaction.editReply({ content: '❌ Error processing payment.', components: [] }).catch(() => { });
            }
            return;
        }

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
// =============================================================================
// 🚀 LAUNCH ALL
// =============================================================================
(async () => {
    try {
        // --- SINGLE INSTANCE LOCK ---
        const SingleInstanceLock = require('./services/SingleInstanceLock');
        const locker = new SingleInstanceLock(supabase, INSTANCE_ID);

        // WAIT FOR LOCK (Do not exit, as that fails Health Checks)
        let acquired = await locker.acquireLock();
        let attempts = 0;
        const MAX_ATTEMPTS = 24; // 24 * 5s = 120s (2 Minutes)

        if (!acquired) {
            console.log(`⏳ [Startup] Another instance is active. Waiting for lock... (Max 2 min)`);

            while (!acquired && attempts < MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
                acquired = await locker.acquireLock();
                attempts++;

                if (acquired) {
                    console.log(`🔓 [Startup] Lock acquired! Starting bots...`);
                    break;
                }
            }

            if (!acquired) {
                console.warn(`⚠️ [Startup] Lock TIMEOUT (${MAX_ATTEMPTS * 5}s). Force starting anyway...`);
            }
        }

        // Lock acquired, proceed
        await startModerationBot();
        await startEconomyBot();
        await startGovernmentBot();
        log('🚀', 'All Initialization Functions Called');
    } catch (error) {
        console.error('💥 FATAL UNIFIED CRASH:', error);
    }
})();
console.log('[SYSTEM] Koyeb Log Test: ERLC Persistence System Active');
