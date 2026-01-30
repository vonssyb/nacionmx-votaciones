const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandLoader');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN_ECO;
const GUILD_ID = process.env.GUILD_ID;
let CLIENT_ID = process.env.CLIENT_ID_ECO;

if (!DISCORD_TOKEN || !GUILD_ID) {
    console.error('❌ ERROR: DISCORD_TOKEN_ECO y GUILD_ID son requeridos.');
    console.error('   -> Variables disponibles:', Object.keys(process.env).filter(k => k.includes('DISCORD') || k.includes('ID')));
    process.exit(1);
}

async function registerEconomyCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // Fetch Client ID if missing
    if (!CLIENT_ID) {
        console.log('⚠️ CLIENT_ID_ECO no encontrado. Obteniendo de la API...');
        try {
            const currentUser = await rest.get(Routes.user('@me'));
            CLIENT_ID = currentUser.id;
            console.log(`✅ Client ID obtenido: ${CLIENT_ID} (${currentUser.username})`);
        } catch (err) {
            console.error('❌ Error obteniendo Client ID:', err.message);
            process.exit(1);
        }
    }

    // 1. Load modular commands from /commands/economy, /commands/games, /commands/utils
    const client = { commands: new Map() };
    const commandsPath = path.join(__dirname, 'commands');
    await loadCommands(client, commandsPath, ['economy', 'games', 'utils', 'business']);

    // 2. Load legacy economy commands from commands.js
    const allLegacyCommands = require('./commands.js');

    // Exclude moderation commands AND modular command names (to avoid duplicates)
    // Exclude moderation commands AND modular command names (to avoid duplicates)
    // ADDED: verificar (Moved to Portal Bot)
    const excludedCommands = ['rol', 'multa_legacy', 'sesion', 'verificar', 'sancion'];

    // Explicitly remove `verificar` from modular commands if it was loaded from utils
    if (client.commands.has('verificar')) {
        client.commands.delete('verificar');
        console.log('⚠️ [ECO] Excluyendo comando modular: /verificar (Mito a Portal)');
    }

    const modularCommandNames = Array.from(client.commands.keys()); // Get names of modular commands

    const legacyEconomyCommands = allLegacyCommands.filter(cmd =>
        !excludedCommands.includes(cmd.name) &&
        !modularCommandNames.includes(cmd.name) // Avoid duplicates
    );

    // 3. Combine modular + legacy
    const modularCommandsData = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    const allCommands = [...modularCommandsData, ...legacyEconomyCommands];
    // const allCommands = [...modularCommandsData]; // TESTING: Only modular

    console.log(`🔄 Registrando ${allCommands.length} comandos de ECONOMÍA en Discord...`);
    console.log(`   -> ${modularCommandsData.length} modulares (economy, games, utils)`);
    console.log(`   -> ${legacyEconomyCommands.length} legacy (bank, business, casino, etc.)`);
    console.log(`📡 Guild ID: ${GUILD_ID}`);
    console.log(`🤖 Client ID: ${CLIENT_ID}`);

    // 0. CLEANUP GLOBAL COMMANDS (Fix for duplicates)
    /*
    try {
        console.log('🧹 Limpiando comandos GLOBALES antiguos...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        console.log('✅ Comandos globales eliminados.');
    } catch (e) {
        console.error('⚠️ Warning cleaning globals:', e.message);
    }
    */

    try {
        console.log(`📡 Enviando comandos a la API de Discord para Guild ID ${GUILD_ID}...`);
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: allCommands }
        );
        console.log(`✅ Respuesta recibida!`);

        console.log(`✅ ${data.length} comandos registrados para el Bot de ECONOMÍA!`);
        console.log('\n📋 Comandos registrados:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        process.exit(1);
    }
}

registerEconomyCommands();
