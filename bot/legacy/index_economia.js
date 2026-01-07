require('dotenv').config();
// 1. Unbuffered Logger
const log = (msg) => process.stderr.write(`🟢 [ECO-BOT] ${msg}\n`);

log('Starting Nacion MX ECONOMY BOT...');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;
// IMPORTANT: Use a DIFFERENT TOKEN for the second bot
const DISCORD_TOKEN = process.env.DISCORD_TOKEN_ECO || process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
// ---------------------

// --- GLOBAL ERROR HANDLERS (MUST BE AT TOP) ---
process.on('unhandledRejection', (reason, p) => {
    console.error('❌ [Unhandled Rejection] at:', p, 'reason:', reason);
    // console.error('Full Stack:', reason.stack);
});

process.on('uncaughtException', (err) => {
    console.error('❌ [Uncaught Exception] thrown:', err);
    // process.exit(1); // Do not exit, try to stay alive
});

// --- SERVICES ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
log('Supabase Initialized');

const BillingService = require('./services/BillingService');
const TaxService = require('./services/TaxService');
const CompanyService = require('./services/CompanyService');
const StakingService = require('./services/StakingService');
const SlotsService = require('./services/SlotsService');
const LevelService = require('./services/LevelService');
const AchievementService = require('./services/AchievementService');
const MissionService = require('./services/MissionService');
const StoreService = require('./services/StoreService');
const { renameChannel } = require('./utils/channelUtils');

// Instantiate Economy Services
const taxService = new TaxService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const companyService = new CompanyService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const levelService = new LevelService(supabase);
const achievementService = new AchievementService(supabase, levelService);
const missionService = new MissionService(supabase, levelService);
const storeService = new StoreService(supabase);
log('Economy Services Instantiated');

// ----------------

// --- CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize Billing Service (Needs Client)
let billingService;
try {
    log('Instantiating BillingService...');
    billingService = new BillingService(client, supabase);
    log('BillingService Instantiated');
} catch (error) {
    console.error('💥 FATAL ERROR Instantiating BillingService:', error);
}

// Attach Services to Client
try {
    client.services = {
        billing: billingService,
        tax: taxService,
        company: companyService,
        staking: new StakingService(supabase),
        slots: new SlotsService(supabase),
        levels: levelService,
        achievements: achievementService,
        missions: missionService,
        store: storeService
    };
    log('Eco Bot Services Attached');
} catch (error) {
    console.error('💥 FATAL ERROR Attaching Services:', error);
}

// --- EVENTS ---

client.once('ready', async () => {
    console.log(`🤖 ECONOMY BOT Started as ${client.user.tag}!`);
    console.log('💰 Economy Systems Online.');

    // Load Commands (ONLY ECONOMY, COMPANIES/BUSINESS, GAMES, UTILITY/UTILS)
    const loader = require('./handlers/commandLoader');
    // Corrected categories based on actual folder structure
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games', 'utils']);

    // Load Legacy Economy Commands from commands.js
    const allLegacyCommands = require('./commands.js');
    const excludedCommands = ['rol', 'sesion']; // Moderation only
    const modularCommandNames = Array.from(client.commands.keys());

    const legacyEconomyCommands = allLegacyCommands.filter(cmd =>
        !excludedCommands.includes(cmd.name) &&
        !modularCommandNames.includes(cmd.name)
    );

    // Add legacy commands to client.commands
    for (const cmd of legacyEconomyCommands) {
        client.commands.set(cmd.name, {
            data: { name: cmd.name },
            execute: async (interaction, client, supabase) => {
                const { handleEconomyLegacy } = require('./handlers/legacyEconomyHandler');
                await handleEconomyLegacy(interaction, client, supabase);
            }
        });
    }
    console.log(`✅ Loaded ${client.commands.size} total commands (${client.commands.size - legacyEconomyCommands.length} modular + ${legacyEconomyCommands.length} legacy)`);

    // Start Jobs
    if (client.services.billing) {
        console.log('⏳ Starting Billing Service Cron...');
        try {
            client.services.billing.startCron();
            console.log('✅ Billing Service Cron Started.');
        } catch (err) {
            console.error('❌ Failed to start Billing Cron:', err);
        }
    }

    // Start Legacy Background Tasks (Stock Market, Store Expiration)
    console.log('⏳ Starting Legacy Background Tasks...');
    try {
        const { startLegacyBackgroundTasks, handleEconomyLegacy } = require('./handlers/legacyEconomyHandler');
        await startLegacyBackgroundTasks(client);
        console.log('✅ Legacy Background Tasks Started.');

        // Expose handler globally or attach to client if needed, but we can just require it here? 
        // Better: require it at top or keep it here if only used here.
        // Actually, we need 'handleEconomyLegacy' in the interaction listener below.
        // So let's attach it to client or make it available.
        client.legacyHandler = handleEconomyLegacy;
    } catch (err) {
        console.error('❌ Failed to start Legacy Background Tasks:', err);
    }
});

client.on('interactionCreate', async interaction => {
    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        // CRITICAL: Defer IMMEDIATELY before any other processing
        await interaction.deferReply({}).catch(e => {
            console.error("CRITICAL: Failed to defer interaction:", e);
            return; // Cannot proceed if defer fails
        });

        // NOW monkey-patch for safety (in case commands call defer manually)
        if (interaction.deferReply) {
            const originalDefer = interaction.deferReply.bind(interaction);
            interaction.deferReply = async (opts) => {
                if (interaction.deferred || interaction.replied) return;
                return originalDefer(opts).catch(e => console.error("Defer error:", e));
            };
        }

        if (interaction.reply) {
            const originalReply = interaction.reply.bind(interaction);
            interaction.reply = async (opts) => {
                if (interaction.replied) return interaction.followUp(opts).catch(e => console.error("FollowUp error:", e));
                if (interaction.deferred) return interaction.editReply(opts).catch(e => console.error("EditReply error:", e));
                return originalReply(opts).catch(e => console.error("Reply error:", e));
            };
        }

        const commandName = interaction.commandName;
        const command = client.commands.get(commandName);

        if (!command) {
            // FALLBACK TO LEGACY HANDLER for migrated commands not yet modularized
            if (client.legacyHandler) {
                try {
                    // console.log(`[Proxy] Routing /${interaction.commandName} to Legacy Handler...`);
                    await client.legacyHandler(interaction, client, supabase);
                } catch (error) {
                    console.error(`[Legacy Error] /${interaction.commandName}:`, error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ Error en comando legacy.', flags: [64] }).catch(() => { });
                    } else {
                        await interaction.editReply({ content: '❌ Error en comando legacy.' }).catch(() => { });
                    }
                }
            }
            return;
        }

        try {
            // Modular commands
            await command.execute(interaction, client, supabase);
        } catch (error) {
            console.error(`[Command Error] /${interaction.commandName}:`, error);
            const content = '❌ Error ejecutando comando.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: [64] }).catch(() => { });
            } else {
                await interaction.reply({ content, flags: [64] }).catch(() => { });
            }
        }
        return;
    }

    // 2. BUTTONS & SELECT MENUS (ECONOMY ONLY - MODULAR)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        // --- NEW: ADMIN CREDIT UPGRADE ---
        if (customId.startsWith('btn_upgrade_')) {
            const creditUpgradeHandler = require('./handlers/creditUpgradeButton');
            await creditUpgradeHandler(interaction, supabase, client.services.billing);
            return;
        }
        if (customId.startsWith('btn_cancel_upgrade_')) {
            await interaction.update({ content: '❌ Oferta rechazada.', embeds: [], components: [] });
            return;
        }

        // -- STORE --
        if (customId.startsWith('buy_item_')) {
            await client.services.store.handleBuyButton(interaction);
            return;
        }

        // -- GENERAL ECONOMY BUTTONS (Debt, Payroll, Vehicles) --
        try {
            const { handleEconomyButtons } = require('./handlers/economyButtonHandler');
            await handleEconomyButtons(interaction, client, supabase, billingService);
        } catch (err) {
            console.error('[Button Error]:', err);
        }
    }
});

// --- RENDER KEEP ALIVE (ECO) ---
const express = require('express');
const app = express();
const port = process.env.PORT_ECO || 3001; // Fix: Ignore generic PORT to avoid conflict on Koyeb
app.get('/', (req, res) => res.send('💰 Nacion MX ECONOMY Bot is running!'));
app.listen(port, () => {
    console.log(`🌐 Economy Server listening on port ${port}`);
});

// LOGIN
// --- LOGIN WITH AUTO-RECONNECT ---
async function startBot() {
    try {
        console.log('🔐 [ECO-BOT] Attempting Discord login...');

        if (DISCORD_TOKEN) {
            console.log(`[ECO-BOT] Token Check: ${DISCORD_TOKEN.substring(0, 5)}...`);
        } else {
            console.log('❌ [ECO-BOT] ERROR: No DISCORD_TOKEN found!');
        }

        await client.login(DISCORD_TOKEN);
        console.log('✅ [ECO-BOT] Discord login successful!');
    } catch (error) {
        console.error('❌ [ECO-BOT] CRITICAL: Discord login failed!', error);
        console.log('🔄 [ECO-BOT] Retrying login in 10 seconds...');
        setTimeout(startBot, 10000);
    }
}

startBot();
