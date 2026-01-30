const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { GUILDS } = require('../config/constants');

// Services
const LevelService = require('../services/LevelService');
const MissionService = require('../services/MissionService');
const AchievementService = require('../services/AchievementService');
const StoreService = require('../services/StoreService');
const BillingService = require('../services/BillingService');
const TaxService = require('../services/TaxService');
const CompanyService = require('../services/CompanyService');
const StakingService = require('../services/StakingService');
const SlotsService = require('../services/SlotsService');
const PaymentProcessor = require('../utils/paymentProcessor');
const ExchangeRateService = require('../services/ExchangeRateService');
const CasinoService = require('../services/CasinoService');
const StockService = require('../services/StockService');
const StateManager = require('../services/StateManager');
const EconomyScheduler = require('../services/EconomyScheduler');
const RateLimitService = require('../services/RateLimitService');

// Orchestrators
const CompanyOrchestrator = require('../handlers/economy/company/orchestrator');
const CompanyManagementHandler = require('../handlers/economy/company/management');
const { handleEconomyInteraction } = require('../handlers/economy/index');
const { handleBankingInteraction } = require('../handlers/bankingHandler');
const { handleEconomyLegacy } = require('../handlers/legacyEconomyHandler');
const ticketHandler = require('../handlers/ticketHandler');

async function startEconomyBot(supabase) {
    logger.info('💰', 'Starting Economy Bot...');
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // Instantiate Services
    const levelService = new LevelService(supabase);
    const missionService = new MissionService(supabase, levelService);
    const achievementService = new AchievementService(supabase, levelService);
    const storeService = new StoreService(supabase);
    const casinoService = new CasinoService(supabase);
    const stockService = new StockService(supabase);

    // Billing Service
    let billingService;
    try { billingService = new BillingService(client, supabase); } catch (e) { logger.errorWithContext('Economy billing service error', e); }

    const paymentProcessor = new PaymentProcessor(supabase, billingService);

    // State Manager
    const stateManager = new StateManager(supabase);
    await stateManager.initialize();

    // Economy Scheduler (Interests, Loans)
    const scheduler = new EconomyScheduler(client, supabase);
    scheduler.start();

    // Rate Limit Service
    const rateLimitService = new RateLimitService();
    // Cleanup every hour
    setInterval(() => {
        rateLimitService.cleanup();
    }, 3600000);

    // Company Handlers
    const companyManagementHandler = new CompanyManagementHandler(client, supabase, paymentProcessor, billingService, stateManager);
    const companyOrchestrator = new CompanyOrchestrator(client, supabase, paymentProcessor, billingService, companyManagementHandler);

    client.services = {
        billing: billingService,
        paymentProcessor: paymentProcessor,
        companyOrchestrator: companyOrchestrator,
        companyManagement: companyManagementHandler,
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
        exchangeRate: new ExchangeRateService(supabase),
        exchangeRate: new ExchangeRateService(supabase),
        stateManager: stateManager,
        scheduler: scheduler,
        rateLimit: rateLimitService
    };

    // Expose casino service shortcut for commands
    client.casinoService = casinoService;

    // Load Commands
    const loader = require('../handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, '../commands'), ['economy', 'business', 'games']);

    // AUTO-REGISTER
    const ECO_TOKEN = process.env.DISCORD_TOKEN_ECO;
    const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

    if (ECO_TOKEN && TARGET_GUILDS.length > 0) {
        (async () => {
            logger.info(`Auto-registering ECO commands`);
            const rest = new REST({ version: '10' }).setToken(ECO_TOKEN);
            try {
                const currentUser = await rest.get(Routes.user('@me'));

                // Get Modular Commands
                let allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

                // Get Legacy Commands
                try {
                    const legacyModule = require('../commands');
                    const legacyList = Array.isArray(legacyModule) ? legacyModule : legacyModule.commands || [];
                    const EXCLUDED_LEGACY = ['info', 'notificaciones']; // Same exclusion as register_commands.js

                    const legacyToAdd = legacyList.filter(l =>
                        !allCommands.some(c => c.name === l.name) &&
                        !EXCLUDED_LEGACY.includes(l.name)
                    );

                    allCommands = [...allCommands, ...legacyToAdd];
                    logger.info(`[ECO] Including ${legacyToAdd.length} legacy commands in auto-register.`);
                } catch (err) {
                    logger.warn(`[ECO] Failed to load legacy commands for auto-register: ${err.message}`);
                }

                for (const guildId of TARGET_GUILDS) {
                    try { await rest.put(Routes.applicationGuildCommands(currentUser.id, guildId), { body: allCommands }); }
                    catch (e) { logger.errorWithContext(`ECO Reg Error`, e, { guildId }); }
                }
            } catch (e) { logger.errorWithContext('Critical ECO Registration Error', e); }
        })();
    }

    client.legacyHandler = handleEconomyLegacy;

    client.once('ready', () => {
        logger.info('🟢', `[ECO] Logged in as ${client.user.tag}`);
        if (client.services?.swarm) client.services.swarm.registerClient(client, 'ECO');
    });

    client.on('interactionCreate', async interaction => {
        if (!rateLimiter.check(interaction.user.id)) return interaction.reply({ content: '⏳ Anti-Spam activado.', ephemeral: true }).catch(() => { });

        try {
            // Handle Casino Interactions (Blackjack Buttons)
            if (interaction.isButton() && interaction.customId.startsWith('btn_bj_')) {
                await casinoService.handleBlackjackInteraction(interaction);
                return;
            }

            // Handle Casino Interactions (Mines Buttons)
            if (interaction.isButton() && interaction.customId.startsWith('btn_mines_')) {
                await casinoService.handleMinesInteraction(interaction);
                return;
            }

            // Handle Casino Interactions (Tower Buttons)
            if (interaction.isButton() && interaction.customId.startsWith('btn_tower_')) {
                await casinoService.handleTowerInteraction(interaction);
                return;
            }

            // Handle Casino Interactions (Penalty Buttons)
            if (interaction.isButton() && interaction.customId.startsWith('btn_pen_')) {
                await casinoService.handlePenaltyInteraction(interaction);
                return;
            }

            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (command) {
                    if (!await safeDefer(interaction, { ephemeral: command.ephemeral || false })) return;
                    await command.execute(interaction, client, supabase);
                }
                return;
            }

            const ATMHandler = require('../handlers/atmHandler');

            // ... in interactionCreate
            // 3. ATM & Banking Handler
            const atmHandler = new ATMHandler(client, supabase);
            if (interaction.customId && interaction.customId.startsWith('atm_')) {
                if (await atmHandler.handleInteraction(interaction)) return;
            }
            // Catch modal transfer
            if (interaction.type === 5 && interaction.customId === 'modal_atm_transfer') { // ModalSubmit
                if (await atmHandler.handleTransferSubmit(interaction)) return;
            }

            // 1. Check Banking Interactions (New System)
            const bankingHandled = await handleBankingInteraction(interaction, client, supabase);
            if (bankingHandled) return;

            // ...

            // 2. Check Ticket Interactions (Closing, etc)
            if (await ticketHandler.handleTicketInteraction(interaction, client, supabase)) return;

            await handleEconomyInteraction(interaction, client, supabase);
        } catch (error) {
            logger.errorWithContext('Economy Interaction Error', error);
        }
    });

    if (!ECO_TOKEN) return logger.info('❌', '[ECO] No Token Found');
    loginWithRetry(client, ECO_TOKEN, 'ECO');
}

module.exports = startEconomyBot;
