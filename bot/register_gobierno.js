const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN_GOV || process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID_GOV || process.env.CLIENT_ID; // Use separate ID if possible
const GUILD_ID = process.env.GUILD_ID;

if (!DISCORD_TOKEN || !GUILD_ID) {
    console.error('❌ Missing DISCORD_TOKEN_GOV or GUILD_ID in .env');
    process.exit(1);
}

const commands = [];
const govPath = path.join(process.cwd(), 'commands/gov');
const utilsPath = path.join(process.cwd(), 'commands/utils');

const folders = [govPath, utilsPath];

for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    const commandFiles = fs.readdirSync(folder).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(folder, file));
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded command: ${command.data.name}`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} government commands...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} government commands.`);
    } catch (error) {
        console.error(error);
    }
})();
