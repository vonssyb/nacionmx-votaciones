const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { CHANNELS, GUILDS, ROLES } = require('../config/constants');
const initRealtimeMonitor = require('../handlers/realtimeMonitor');

// Services
const SanctionService = require('../services/SanctionService');
const BillingService = require('../services/BillingService');
const DailyMissionManager = require('../services/DailyMissionManager');
const CasinoService = require('../services/CasinoService');
const StockService = require('../services/StockService');
const LogManager = require('../services/LogManager');
const RoleManager = require('../services/RoleManager');
const CacheService = require('../services/CacheService');
const ErlcService = require('../services/ErlcService');
const ErlcScheduler = require('../services/ErlcScheduler');
const ErlcLogManager = require('../services/ErlcLogManager');
const ErlcPollingService = require('../services/ErlcPollingService');
const VoiceSwarmService = require('../services/VoiceSwarmService');
const StateManager = require('../services/StateManager');

// Handlers
const { handleEconomyInteraction } = require('../handlers/economy/index');
const { handleModerationInteraction } = require('../handlers/moderation/index');
const { handleBankingInteraction } = require('../handlers/bankingHandler');
const { handleTicketMessage } = require('../handlers/ticketMessageHandler');
const { handleTicketInteraction } = require('../handlers/ticketHandler');

async function startModerationBot(supabase) {
    logger.info('👮‍♂️', 'Starting Moderation Bot...');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    client.commands = new Collection();
    client.supabase = supabase;

    // --- AUDIT LOGGING ---
    client.logAudit = async (action, details, moderator, target, color = 0x00AAFF, files = [], channelId = null) => {
        try {
            // Use Security channel from constants
            const targetChannelId = channelId || CHANNELS.LOGS_SECURITY;
            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (channel) {
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

    // Instantiate Services
    const erlcService = new ErlcService(process.env.ERLC_API_KEY);
    const logManager = new LogManager(client, supabase);
    const roleManager = new RoleManager(client);
    const cacheService = new CacheService();
    const sanctionService = new SanctionService(supabase, client, logManager, roleManager, erlcService);

    // Voice Managers
    const TemporaryChannelManager = require('../utils/temporaryChannelManager');
    const VoicePermissionManager = require('../utils/voicePermissionManager');
    const VoiceActivityHandler = require('../handlers/voiceActivityHandler');
    client.tempChannelManager = new TemporaryChannelManager(client, supabase);
    client.voicePermissionManager = new VoicePermissionManager(supabase);
    client.voiceActivityHandler = new VoiceActivityHandler(client, supabase);
    client.missionManager = new DailyMissionManager(supabase);

    // ERLC Components
    const erlcScheduler = new ErlcScheduler(supabase, process.env.ERLC_API_KEY);
    if (!process.env.ERLC_API_KEY) logger.warn('⚠️ ERLC_API_KEY missing!');
    erlcScheduler.start(120 * 1000);

    // Use Audit Log Channel for ERLC Logs
    const erlcLogManager = new ErlcLogManager(client, supabase, erlcService, CHANNELS.LOGS_AUDIT);
    erlcLogManager.start();

    // Swarm
    const swarmTokens = process.env.VOICE_SWARM_TOKENS ? process.env.VOICE_SWARM_TOKENS.split(',') : [];
    const swarmService = new VoiceSwarmService(swarmTokens);
    swarmService.init().catch(err => console.error('❌ [Swarm] Init Failed:', err));

    const erlcPollingService = new ErlcPollingService(supabase, client, swarmService, erlcService);
    erlcPollingService.start();

    // Company Components
    const stateManager = new StateManager(supabase);
    await stateManager.initialize();

    const CompanyManagementHandler = require('../handlers/economy/company/management');
    const CompanyOrchestrator = require('../handlers/economy/company/orchestrator');
    const PaymentProcessor = require('../utils/paymentProcessor');
    const billingService = new BillingService(client, supabase);
    const paymentProcessor = new PaymentProcessor(supabase, billingService);
    const companyManagementHandler = new CompanyManagementHandler(client, supabase, paymentProcessor, billingService, stateManager);
    const companyOrchestrator = new CompanyOrchestrator(client, supabase, paymentProcessor, billingService, companyManagementHandler);

    client.services = {
        cache: cacheService,
        sanctions: sanctionService,
        billing: billingService,
        casino: new CasinoService(supabase),
        stocks: new StockService(supabase),
        erlcScheduler: erlcScheduler,
        erlc: erlcService,
        erlcLogManager: erlcLogManager,
        erlcPolling: erlcPollingService,
        swarm: swarmService,
        stateManager: stateManager,
        companyManagement: companyManagementHandler,
        companyOrchestrator: companyOrchestrator,
        logManager: logManager,
        roleManager: roleManager
    };

    // Load Commands
    const loader = require('../handlers/commandLoader');
    await loader.loadCommands(client, path.join(__dirname, '../commands'), ['moderation', 'utils', 'owner', 'tickets']);

    // AUTO-REGISTER
    const MOD_TOKEN = process.env.DISCORD_TOKEN_MOD;
    const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

    if (MOD_TOKEN && TARGET_GUILDS.length > 0) {
        (async () => {
            logger.info(`Auto-registering MOD commands`);
            const rest = new REST({ version: '10' }).setToken(MOD_TOKEN);
            try {
                const currentUser = await rest.get(Routes.user('@me'));
                const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
                for (const guildId of TARGET_GUILDS) {
                    try { await rest.put(Routes.applicationGuildCommands(currentUser.id, guildId), { body: allCommands }); }
                    catch (e) { logger.errorWithContext(`MOD Reg Error`, e, { guildId }); }
                }
            } catch (e) { logger.errorWithContext('Critical MOD Registration Error', e); }
        })();
    }

    // Events
    client.once('ready', () => {
        logger.info('🟢', `[MOD] Logged in as ${client.user.tag}`);
        if (swarmService) swarmService.registerClient(client, 'MOD');
        if (client.tempChannelManager) client.tempChannelManager.startCleanup();
        if (client.voiceActivityHandler) {
            client.voiceActivityHandler.initialize();
            client.voiceActivityHandler.cleanupOpenSessions();
        }
        initRealtimeMonitor(client, supabase);
    });

    // --- EVENT MODULES (Refactored) ---
    const events = {
        messageDelete: require('../handlers/events/messageDelete'),
        guildMemberAdd: require('../handlers/events/guildMemberAdd'),
        guildMemberUpdate: require('../handlers/events/guildMemberUpdate'),
        messageUpdate: require('../handlers/events/messageUpdate'),
        voiceStateUpdate: require('../handlers/events/voiceStateUpdate')
    };

    client.on('messageDelete', (message) => events.messageDelete(client, message, supabase));
    client.on('guildMemberAdd', (member) => events.guildMemberAdd(client, member, supabase));
    client.on('guildMemberUpdate', (oldMember, newMember) => events.guildMemberUpdate(client, oldMember, newMember, supabase));
    client.on('messageUpdate', (oldMessage, newMessage) => events.messageUpdate(client, oldMessage, newMessage, supabase));
    client.on('voiceStateUpdate', (oldState, newState) => events.voiceStateUpdate(client, oldState, newState, supabase));

    // Ticket Handler
    client.on('messageCreate', async message => {
        try { await handleTicketMessage(message, client, supabase); } catch (err) { logger.errorWithContext('Ticket msg error', err); }
    });

    client.on('interactionCreate', async interaction => {
        if (!rateLimiter.check(interaction.user.id)) return interaction.reply({ content: '⏳ Slow down.', ephemeral: true }).catch(() => { });

        try { await handleTicketInteraction(interaction, client, supabase); } catch (e) { }

        if (!interaction.isChatInputCommand()) {
            try {
                const banking = await handleBankingInteraction(interaction, client, supabase);
                if (banking) return;
                await handleModerationInteraction(interaction, client, supabase);
            } catch (e) {
                logger.errorWithContext('Mod Orchestrator Error', e, {
                    command: interaction.commandName,
                    user: interaction.user.tag,
                    customId: interaction.customId
                });
            }
            return;
        }

        const ephemeralCommands = ['vc', '911', 'talk'];
        const isEphemeral = ephemeralCommands.includes(interaction.commandName);
        if (!await safeDefer(interaction, { ephemeral: isEphemeral })) return;

        // Command Log
        if (isEphemeral) {
            const logCh = await client.channels.fetch(CHANNELS.LOGS_COMMANDS).catch(() => null);
            if (logCh) {
                // Simple log
                const opts = interaction.options.data.map(o => `${o.name}:${o.value}`).join(' ');
                logCh.send(`📝 **/${interaction.commandName}** used by ${interaction.user.tag} (${opts})`);
            }
        }

        const command = client.commands.get(interaction.commandName);
        if (command) {
            try { await command.execute(interaction, client, supabase); }
            catch (e) { logger.error('CMD Error', e); await interaction.editReply('Error executing command.').catch(() => { }); }
        }
    });

    if (!MOD_TOKEN) return logger.info('❌', '[MOD] No Token Found');
    loginWithRetry(client, MOD_TOKEN, 'MOD');
}

module.exports = startModerationBot;
