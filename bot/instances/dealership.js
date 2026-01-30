const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const path = require('path');
const logger = require('../services/Logger');
const { safeDefer } = require('../utils/discordHelper');
const loginWithRetry = require('../utils/loginHelper');
const rateLimiter = require('../utils/rateLimiter');
const { GUILDS } = require('../config/constants');

// We will load services later as we build them
const DealershipService = require('../services/DealershipService');

async function startDealershipBot(supabase) {
    logger.info('🚗', 'Starting Dealership Bot...');
    const DEALERSHIP_TOKEN = process.env.DISCORD_TOKEN_DEALERSHIP; // [FIX] Defined at function scope
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

    // Load Services
    client.dealershipService = new DealershipService(supabase);

    // Load Commands
    const loader = require('../handlers/commandLoader');
    // Ensure the dealership commands folder exists first
    await loader.loadCommands(client, path.join(__dirname, '../commands'), ['dealership']);

    client.once('ready', async () => {
        logger.info('🟢', `[DEALERSHIP] Logged in as ${client.user.tag}`);
        client.user.setActivity('autos de lujo 🏎️', { type: 4 });

        // Register commands for ALL guilds the bot acts in (since this might be a standalone server)
        if (DEALERSHIP_TOKEN) {
            const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);
            const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

            logger.info(`[DEALERSHIP] Fetching guilds for command registration...`);
            const guilds = await client.guilds.fetch();

            for (const [guildId, guild] of guilds) {
                try {
                    logger.info(`[DEALERSHIP] Registering commands in ${guild.name} (${guildId})`);
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: allCommands });
                    logger.info(`✅ [DEALERSHIP] Commands registered for ${guild.name}`);
                } catch (e) {
                    logger.errorWithContext(`DEALERSHIP Reg Error`, e, { guildId });
                }
            }
        }
    });

    // Register commands when joining a new guild
    client.on('guildCreate', async guild => {
        logger.info(`[DEALERSHIP] Joined new guild: ${guild.name}. Registering commands...`);
        if (!DEALERSHIP_TOKEN) return;

        const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);
        const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: allCommands });
            logger.info(`✅ [DEALERSHIP] Commands registered for ${guild.name}`);
        } catch (e) {
            logger.errorWithContext(`DEALERSHIP New Guild Reg Error`, e, { guildId: guild.id });
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!rateLimiter.check(interaction.user.id)) return interaction.reply({ content: '⏳ Anti-Spam activado.', ephemeral: true }).catch(() => { });

        try {
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (command) {
                    if (!await safeDefer(interaction, { ephemeral: command.ephemeral || false })) return;
                    await command.execute(interaction, client, supabase);
                }
                return;
            }

            // Future: Button/Modal handlers
            // if (interaction.customId.startsWith('dealership_')) ...

        } catch (error) {
            logger.errorWithContext('Dealership Interaction Error', error);
        }
    });

    if (!DEALERSHIP_TOKEN) return logger.warn('⚠️', '[DEALERSHIP] No Token Found. Bot will not start.');
    loginWithRetry(client, DEALERSHIP_TOKEN, 'DEALERSHIP');

    return client;
}

module.exports = startDealershipBot;
