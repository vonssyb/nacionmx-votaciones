const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '.env')) ? path.join(__dirname, '.env') : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });

console.log('--- DEBUG ENV ---');
console.log('Path:', envPath);
console.log('DISCORD_TOKEN_GOV:', process.env.DISCORD_TOKEN_GOV ? (process.env.DISCORD_TOKEN_GOV.substring(0, 10) + '...') : 'UNDEFINED');
console.log('-----------------');

const GUILD_ID = process.env.GUILD_ID;

// Collect all commands from all bots
const commands = [];

// Load commands dynamically from folders
const allCommandsByFolder = {};
const commandFolders = ['moderation', 'utils', 'economy', 'business', 'games', 'gov', 'owner', 'tickets'];

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
        commandFolders: ['moderation', 'utils', 'owner', 'tickets']
    },
    {
        name: 'Economía',
        appId: '1456449944830611685',
        token: process.env.DISCORD_TOKEN_ECO,
        commandFolders: ['economy', 'business', 'games'],
        useGlobal: true // Use Global Commands due to Guild API hang
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
            console.log(`\n🤖 Deploying to ${bot.name} (${bot.useGlobal ? 'Global' : 'Guild'})...`);

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
            console.log(`   [DEBUG] Token length: ${bot.token?.length}, First 5: ${bot.token?.substring(0, 5)}...`);
            console.log(`   [DEBUG] App ID: ${bot.appId}, Guild ID: ${GUILD_ID}`);

            if (!bot.token) {
                console.error('   ❌ Token is missing/empty string!');
                continue;
            }

            if (!bot.token) {
                console.error('   ❌ Token is missing/empty string!');
                continue;
            }

            const rest = new REST({ version: '10' }).setToken(bot.token.trim());

            // 1. CLEANUP OPPOSITE SCOPE
            if (!bot.useGlobal) {
                // If using Guild, clean Global
                try {
                    console.log('   🧹 Cleaning Global commands...');
                    await rest.put(Routes.applicationCommands(bot.appId), { body: [] });
                } catch (e) { console.log('   (No global commands found or permission error)'); }
            } else {
                // If using Global, clean Guild (THIS FIXES DUPLICATES)
                try {
                    console.log(`   🧹 Cleaning Guild commands for ${GUILD_ID}...`);
                    await rest.put(Routes.applicationGuildCommands(bot.appId, GUILD_ID), { body: [] });
                } catch (e) { console.log('   (No guild commands found or permission error)'); }
            }

            const route = bot.useGlobal
                ? Routes.applicationCommands(bot.appId)
                : Routes.applicationGuildCommands(bot.appId, GUILD_ID);

            const data = await rest.put(
                route,
                { body: botCommands },
            );

            console.log(`✅ ${bot.name}: Successfully registered ${data.length} commands!`);

        } catch (error) {
            console.error(`❌ ${bot.name} Error:`, error.message);
        }
    }

    console.log('\n🎉 All done! Commands should appear in Discord immediately.');
})();
