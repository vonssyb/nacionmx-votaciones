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
const billingService = new BillingService(client, supabase);

// Attach Services to Client
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

// --- EVENTS ---

client.once('clientReady', async () => {
    console.log(`🤖 ECONOMY BOT Started as ${client.user.tag}!`);
    console.log('💰 Economy Systems Online.');

    // Load Commands (ONLY ECONOMY, COMPANIES/BUSINESS, GAMES, UTILITY/UTILS)
    const loader = require('./handlers/commandLoader');
    // Corrected categories based on actual folder structure
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games', 'utils']);

    // Load Legacy Economy Commands from commands.js
    const allLegacyCommands = require('./commands.js');
    const excludedCommands = ['fichar', 'rol', 'multa', 'licencia', 'sesion']; // Moderation only
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
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            // FALLBACK TO LEGACY HANDLER for migrated commands not yet modularized
            if (client.legacyHandler) {
                try {
                    // console.log(`[Proxy] Routing /${interaction.commandName} to Legacy Handler...`);
                    await client.legacyHandler(interaction, client, supabase);
                } catch (error) {
                    console.error(`[Legacy Error] /${interaction.commandName}:`, error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ Error en comando legacy.', ephemeral: true }).catch(() => { });
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
                await interaction.followUp({ content, ephemeral: true }).catch(() => { });
            } else {
                await interaction.reply({ content, ephemeral: true }).catch(() => { });
            }
        }
        return;
    }

    // 2. BUTTONS & SELECT MENUS (ECONOMY ONLY - MODULAR)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

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
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('💰 Nacion MX ECONOMY Bot is running!'));
app.listen(port, () => {
    console.log(`🌐 Economy Server listening on port ${port}`);
});

// LOGIN
client.login(DISCORD_TOKEN);
