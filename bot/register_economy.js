const path = require('path');
// Try loading from bot/.env
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Try loading from root .env (overwrites/augments)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./handlers/commandLoader');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN_ECO || process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
let CLIENT_ID = process.env.CLIENT_ID_ECO || process.env.CLIENT_ID;

if (!DISCORD_TOKEN || !GUILD_ID) {
    console.error('❌ ERROR: DISCORD_TOKEN_ECO (o DISCORD_BOT_TOKEN) y GUILD_ID son requeridos.');
    console.error('   -> Busqué en:', path.join(__dirname, '.env'), 'y', path.join(__dirname, '../.env'));
    console.error('   -> Env Vars Disponibles (Keys):', Object.keys(process.env).filter(k => k.includes('DISCORD') || k.includes('ID')));
    process.exit(1);
}

async function registerEconomyCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // 1. Fetch Client ID if missing
    if (!CLIENT_ID) {
        console.log('⚠️ CLIENT_ID no encontrado en .env. Obteniendo de la API...');
        try {
            const currentUser = await rest.get(Routes.user('@me'));
            CLIENT_ID = currentUser.id;
            console.log(`✅ Client ID obtenido: ${CLIENT_ID}`);
        } catch (err) {
            console.error('❌ Error obteniendo Client ID. Verifica el Token.');
            process.exit(1);
        }
    }

    // 2. Load Commands Dynamically
    const client = { commands: new Map() };
    const commandsPath = path.join(__dirname, 'commands');
    // Categories for Economy Bot
    const categories = ['economy', 'business', 'games', 'utils'];

    console.log(`📂 Cargando comandos de: ${categories.join(', ')}`);
    await loadCommands(client, commandsPath, categories);

    const commandsData = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    console.log(`🔄 Registrando ${commandsData.length} comandos en Discord...`);
    console.log(`📡 Guild ID: ${GUILD_ID}`);
    console.log(`🤖 Client ID: ${CLIENT_ID}`);

    try {
        // Register to specific guild (instant updates)
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commandsData }
        );

        console.log(`✅ ${data.length} comandos registrados exitosamente para el Bot de Economía!`);
        console.log('🎉 Los comandos deberían aparecer instantáneamente en Discord.');
        console.log('\n📋 Comandos registrados:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        process.exit(1);
    }
}

registerEconomyCommands();
