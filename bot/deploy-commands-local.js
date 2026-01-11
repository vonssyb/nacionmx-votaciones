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

console.log(`\n📋 Total commands loaded: ${commands.length}\n`);

// Deploy commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN_ECO);

(async () => {
    try {
        console.log(`🔄 Registering ${commands.length} commands to guild ${GUILD_ID}...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID || '1398525202618273965', GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Successfully registered ${data.length} application commands locally!\n`);
        console.log('Commands should appear in Discord immediately.');

    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
