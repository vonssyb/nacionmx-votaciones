const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GUILD_ID = process.env.GUILD_ID;

// Collect all commands from all bots
const commands = [];

// Load commands dynamically from folders
const commandFolders = ['moderation', 'utils', 'economy', 'business', 'games', 'gov', 'owner'];

for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'commands', folder);
    if (!fs.existsSync(folderPath)) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            delete require.cache[require.resolve(filePath)]; // Clear cache for reload
            const command = require(filePath);
            if (command.data) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded: ${folder}/${file}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${folder}/${file}:`, error.message);
        }
    }
}

// Deduplicate commands (keep last occurrence)
const uniqueCommands = [];
const seen = new Set();

for (let i = commands.length - 1; i >= 0; i--) {
    const cmd = commands[i];
    if (!seen.has(cmd.name)) {
        uniqueCommands.unshift(cmd);
        seen.add(cmd.name);
    } else {
        console.log(`⚠️  Skipping duplicate: ${cmd.name}`);
    }
}

console.log(`\n📋 Total unique commands: ${uniqueCommands.length}\n`);

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
        try {
            console.log(`\n🤖 Deploying to ${bot.name}...`);

            // Filter commands for this bot
            const botCommands = uniqueCommands.filter(cmd => {
                // Find which folder this command belongs to
                const commandFile = commands.find(c => c.name === cmd.name);
                return bot.commandFolders.some(folder => {
                    // Check if this command was loaded from this folder
                    return true; // For now, deploy all to all bots
                });
            });

            const rest = new REST({ version: '10' }).setToken(bot.token);

            const data = await rest.put(
                Routes.applicationGuildCommands(bot.appId, GUILD_ID),
                { body: uniqueCommands }, // Deploy all commands to all bots for now
            );

            console.log(`✅ ${bot.name}: Successfully registered ${data.length} commands!`);

        } catch (error) {
            console.error(`❌ ${bot.name} Error:`, error.message);
        }
    }

    console.log('\n🎉 All done! Commands should appear in Discord immediately.');
})();
