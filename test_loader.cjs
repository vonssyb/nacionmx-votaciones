const path = require('path');
const { loadCommands } = require('./bot/handlers/commandLoader');

async function testLoad() {
    const client = { commands: new Map() };
    const commandsPath = path.join(__dirname, 'bot/commands');

    console.log('Testing command loader for [gov, utils]...');
    await loadCommands(client, commandsPath, ['gov', 'utils']);

    console.log(`Loaded ${client.commands.size} commands.`);

    const expected = ['dni', 'licencia', 'banxico'];
    expected.forEach(cmd => {
        if (client.commands.has(cmd)) {
            console.log(`✅ Found: ${cmd}`);
        } else {
            console.error(`❌ MISSING: ${cmd}`);
        }
    });

    // List all loaded names
    console.log('All loaded:', Array.from(client.commands.keys()));
}

testLoad();
