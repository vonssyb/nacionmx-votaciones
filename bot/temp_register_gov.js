const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// VALUES FROM USER SCREENSHOT
const DISCORD_TOKEN = 'MTQ1ODEzNDI1MjM1OTQ0MDMwMw.GX-cjtbdTEGkS0T1gpDujPBSjYMAve3cemyA-c';
const CLIENT_ID = '1458134252359440303'; // Extracted manually or from previous session logs if available
const GUILD_ID = '1398525215134318713';

const commands = [];
const govPath = path.join(process.cwd(), 'bot/commands/gov');

if (fs.existsSync(govPath)) {
    const commandFiles = fs.readdirSync(govPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(govPath, file));
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`✅ Loaded: ${command.data.name}`);
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
