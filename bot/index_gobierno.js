require('dotenv').config();
const log = (msg) => process.stderr.write(`🟢 [GOV-BOT] ${msg}\n`);

log('Starting Nacion MX GOVERNMENT BOT...');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const DISCORD_TOKEN = process.env.DISCORD_TOKEN_GOV || process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID ? process.env.GUILD_ID.trim() : null;

// --- SERVICES ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
log('Supabase Initialized');

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

// --- CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.services = {
    levels: levelService,
    missions: missionService,
    achievements: achievementService,
    billing: billingService,
    exchange: exchangeService
};

// --- EVENTS ---
client.once('clientReady', async () => {
    console.log(`🤖 GOVERNMENT BOT Started as ${client.user.tag}!`);
    console.log('🏛️ Government & Citizenship Systems Online.');

    const loader = require('./handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['gov', 'utils']);

    // Fallback for DNI (which is still in legacy handler)
    const { handleEconomyLegacy } = require('./handlers/legacyEconomyHandler');
    client.legacyHandler = handleEconomyLegacy;

    console.log(`✅ Loaded ${client.commands.size} government commands.`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Instant defer
    if (interaction.deferReply) {
        const originalDefer = interaction.deferReply.bind(interaction);
        interaction.deferReply = async (opts) => {
            if (interaction.deferred || interaction.replied) return;
            return originalDefer(opts).catch(e => console.error("Defer error:", e));
        };
    }

    await interaction.deferReply({}).catch(() => { });

    const command = client.commands.get(interaction.commandName);

    if (command) {
        try {
            await command.execute(interaction, client, supabase);
        } catch (error) {
            console.error(`[Gov Error] /${interaction.commandName}:`, error);
            const content = '❌ Error ejecutando comando gubernamental.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content, flags: [64] }).catch(() => { });
            } else {
                await interaction.reply({ content, flags: [64] }).catch(() => { });
            }
        }
    } else {
        // Fallback to legacy for DNI etc.
        const govLegacyCommands = ['dni'];
        if (govLegacyCommands.includes(interaction.commandName) && client.legacyHandler) {
            try {
                await client.legacyHandler(interaction, client, supabase);
            } catch (error) {
                console.error(`[Gov Legacy Error] /${interaction.commandName}:`, error);
            }
        }
    }
});

// --- RENDER KEEP ALIVE (GOV) ---
const express = require('express');
const app = express();
const port = process.env.PORT_GOV || 3001;
app.get('/', (req, res) => res.send('🏛️ Nacion MX GOVERNMENT Bot is running!'));
app.listen(port, () => {
    console.log(`🌐 Government Server listening on port ${port}`);
});

client.login(DISCORD_TOKEN);
