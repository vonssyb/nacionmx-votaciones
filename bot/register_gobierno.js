const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandLoader');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN_GOV;
const GUILD_ID = process.env.GUILD_ID;
let CLIENT_ID = process.env.CLIENT_ID_GOV; // Optional in .env, fetched if missing

if (!DISCORD_TOKEN || !GUILD_ID) {
    console.error('❌ ERROR: GUILD_ID es requerido.');
    process.exit(1);
}
console.log(`DEBUG: Token loaded: ${DISCORD_TOKEN ? DISCORD_TOKEN.substring(0, 10) + '...' : 'NONE'}`);
console.log(`DEBUG: Env loaded from: ${path.join(__dirname, '.env')}`);

async function registerGovernmentCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // Fetch Client ID (Always fetch to ensure token match)
    // if (!CLIENT_ID) {
    console.log('⚠️ Validando Client ID con API...');
    try {
        const currentUser = await rest.get(Routes.user('@me'));
        CLIENT_ID = currentUser.id;
        console.log(`✅ Client ID verificado: ${CLIENT_ID} (${currentUser.username})`);
    } catch (err) {
        console.error('❌ Error obteniendo Client ID:', err.message);
        process.exit(1);
    }
    // }

    // 1. Load modular commands from /commands/gov and /commands/utils
    // Note: Government bot generally only needs gov specific + utils
    const client = { commands: new Map() };
    const commandsPath = path.join(__dirname, 'commands');

    console.log('🔄 Cargando comandos de Gobierno...');
    // Added 'utils' to ensure helper commands are present. 
    // If we are unifying, we might want 'economy' too, but let's stick to what's requested + utils.
    // User requested "todos los comandos completos". 
    // 'gov' has DNI, Licencia. 'utils' has Ayuda.
    // 'economy' has Banxico? No, Banxico is in 'gov' now (migrated).
    const categoriesToLoad = ['gov', 'utils', 'economy', 'business', 'games'];
    await loadCommands(client, commandsPath, categoriesToLoad);

    const allCommands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    console.log(`🔄 Registrando ${allCommands.length} comandos de GOBIERNO en Discord...`);
    console.log(`   -> Includes categories: ${categoriesToLoad.join(', ')}`);

    // Create Audit File for User
    const fs = require('fs');
    const auditContent = allCommands.map(c => `- /${c.name}`).sort().join('\n');
    fs.writeFileSync('REGISTERED_COMMANDS_LOG.txt', `Ultimo Registro: ${new Date().toISOString()}\n\n${auditContent}`);
    console.log('📄 Lista de comandos guardada en REGISTERED_COMMANDS_LOG.txt');

    console.log(`📡 Guild ID: ${GUILD_ID}`);
    console.log(`🤖 Client ID: ${CLIENT_ID}`);

    // 0. CLEANUP GLOBAL COMMANDS (Fix for duplicates)
    try {
        console.log('🧹 Limpiando comandos GLOBALES antiguos (para evitar duplicados)...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        console.log('✅ Comandos globales eliminados correctamente.');
    } catch (e) {
        console.error('⚠️ No se pudieron limpiar comandos globales (posiblemente 401 o falta de permisos):', e.message);
    }

    try {
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: allCommands }
        );

        console.log(`✅ ${data.length} comandos registrados para el Bot de GOBIERNO!`);
        console.log('\n📋 Comandos registrados:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        process.exit(1);
    }
}

registerGovernmentCommands();
