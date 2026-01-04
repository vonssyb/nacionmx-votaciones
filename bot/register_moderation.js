const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandLoader');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
let CLIENT_ID = process.env.CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;

if (!DISCORD_TOKEN || !GUILD_ID) {
    console.error('❌ ERROR: DISCORD_TOKEN y GUILD_ID son requeridos.');
    console.error('   -> Variables disponibles:', Object.keys(process.env).filter(k => k.includes('DISCORD') || k.includes('ID')));
    process.exit(1);
}

async function registerModerationCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // Fetch Client ID if missing
    if (!CLIENT_ID) {
        console.log('⚠️ CLIENT_ID no encontrado. Obteniendo de la API...');
        try {
            const currentUser = await rest.get(Routes.user('@me'));
            CLIENT_ID = currentUser.id;
            console.log(`✅ Client ID obtenido: ${CLIENT_ID} (${currentUser.username})`);
        } catch (err) {
            console.error('❌ Error obteniendo Client ID:', err.message);
            process.exit(1);
        }
    }

    // 1. Load modular commands from /commands/moderation (includes new moderation-specific ayuda.js)
    const client = { commands: new Map() };
    const commandsPath = path.join(__dirname, 'commands');
    await loadCommands(client, commandsPath, ['moderation']);

    // 2. Load legacy moderation commands from commands.js
    const allLegacyCommands = require('./commands.js');
    const legacyModerationNames = ['multa', 'licencia', 'rol', 'ping', 'info'];
    // Exclude 'ayuda' because we have moderation-specific ayuda in /commands/moderation/
    const legacyCommands = allLegacyCommands.filter(cmd => legacyModerationNames.includes(cmd.name));

    // 3. Combine modular + legacy
    const modularCommandsData = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    const allCommands = [...modularCommandsData, ...legacyCommands];

    console.log(`🔄 Registrando ${allCommands.length} comandos de MODERACIÓN/STAFF en Discord...`);
    console.log(`   -> ${modularCommandsData.length} modulares (moderation - includes ayuda)`);
    console.log(`   -> ${legacyCommands.length} legacy (fichar, rol, multa, etc.)`);
    console.log(`📡 Guild ID: ${GUILD_ID}`);
    console.log(`🤖 Client ID: ${CLIENT_ID}`);

    try {
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: allCommands }
        );

        console.log(`✅ ${data.length} comandos registrados para el Bot de MODERACIÓN!`);
        console.log('\n📋 Comandos registrados:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        process.exit(1);
    }
}

registerModerationCommands();
