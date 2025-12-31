// test_loader.cjs
const path = require('path');
const { loadCommands } = require('./bot/handlers/commandLoader');

const client = { commands: new Map() };
const commandsPath = path.join(__dirname, 'bot', 'commands');

console.log(`📂 Loading commands from: ${commandsPath}`);

async function run() {
    try {
        const count = await loadCommands(client, commandsPath);
        console.log(`✅ Loaded ${count} commands.`);
    } catch (error) {
        console.error('❌ Failed to load commands:', error);
    }
}

run();
