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

    // AUTO-REGISTER
    const DEALERSHIP_TOKEN = process.env.DISCORD_TOKEN_DEALERSHIP;
    const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

    if (DEALERSHIP_TOKEN && TARGET_GUILDS.length > 0) {
        (async () => {
            logger.info(`Auto-registering DEALERSHIP commands`);
            const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);
            try {
                const currentUser = await rest.get(Routes.user('@me'));
                const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

                for (const guildId of TARGET_GUILDS) {
                    try {
                        await rest.put(Routes.applicationGuildCommands(currentUser.id, guildId), { body: allCommands });
                        logger.info(`✅ [DEALERSHIP] Commands registered for guild ${guildId}`);
                    }
                    catch (e) { logger.errorWithContext(`DEALERSHIP Reg Error`, e, { guildId }); }
                }
            } catch (e) { logger.errorWithContext('Critical DEALERSHIP Registration Error', e); }
        })();
    }

    client.once('ready', () => {
        logger.info('🟢', `[DEALERSHIP] Logged in as ${client.user.tag}`);
        client.user.setActivity('autos de lujo 🏎️', { type: 4 }); // Custom status
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
