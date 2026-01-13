const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '.env')) ? path.join(__dirname, '.env') : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

const GUILD_ID = process.env.GUILD_ID;

// Collect all commands from all bots
const commands = [];

// Load commands dynamically from folders
const allCommandsByFolder = {};
const commandFolders = ['moderation', 'utils', 'economy', 'business', 'games', 'gov', 'owner'];

for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'commands', folder);
    if (!fs.existsSync(folderPath)) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    allCommandsByFolder[folder] = [];

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            if (command.data) {
                const cmdJSON = command.data.toJSON();
                allCommandsByFolder[folder].push(cmdJSON);
                console.log(`✅ Loaded: ${folder}/${file}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${folder}/${file}:`, error.message);
        }
    }
}

// Bot configurations
const bots = [
    {
        name: 'Portal (Moderación)',
        appId: '1450701617685991621',
        token: process.env.DISCORD_TOKEN,
        commandFolders: ['moderation', 'utils', 'owner']
    },
    {
        name: 'Economía',
        appId: '1456449944830611685',
        token: process.env.DISCORD_TOKEN_ECO,
        commandFolders: ['economy', 'business', 'games']
    },
    {
        name: 'Gobierno',
        appId: '1458134280352829443',
        token: process.env.DISCORD_TOKEN_GOV,
        commandFolders: ['gov']
    }
];

// Deploy to each bot
(async () => {
    for (const bot of bots) {
        if (!bot.token) {
            console.warn(`\n⚠️  Skipping ${bot.name}: Token not found.`);
            continue;
        }

        try {
            console.log(`\n🤖 Deploying to ${bot.name}...`);

            // Collect commands for this specific bot based on its folders
            const botCommands = [];
            const seenNames = new Set();

            for (const folder of bot.commandFolders) {
                if (allCommandsByFolder[folder]) {
                    for (const cmd of allCommandsByFolder[folder]) {
                        if (!seenNames.has(cmd.name)) {
                            botCommands.push(cmd);
                            seenNames.add(cmd.name);
                        } else {
                            console.log(`   ⚠️  Skipping duplicate within ${bot.name}: ${cmd.name}`);
                        }
                    }
                }
            }

            console.log(`   📋 Registering ${botCommands.length} commands for ${bot.name}...`);

            const rest = new REST({ version: '10' }).setToken(bot.token);

            // 1. CLEANUP GLOBAL COMMANDS (To avoid "duplicate" entries if they were global before)
            try {
                await rest.put(Routes.applicationCommands(bot.appId), { body: [] });
            } catch (e) { /* Ignore 401/403 on globals cleanup */ }

            const data = await rest.put(
                Routes.applicationGuildCommands(bot.appId, GUILD_ID),
                { body: botCommands },
            );

            console.log(`✅ ${bot.name}: Successfully registered ${data.length} commands!`);

        } catch (error) {
            console.error(`❌ ${bot.name} Error:`, error.message);
        }
    }

    console.log('\n🎉 All done! Commands should appear in Discord immediately.');
})();
