const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { REST, Routes } = require('discord.js');

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

    // Load ALL commands from commands.js
    const allCommands = require('./commands.js');

    // Filter ONLY Moderation/Staff commands
    const moderationCommandNames = [
        'ping', 'ayuda', 'info',
        'rol', 'multa', 'licencia', 'sesion', 'fichar'
    ];

    const moderationCommands = allCommands.filter(cmd => moderationCommandNames.includes(cmd.name));

    console.log(`🔄 Registrando ${moderationCommands.length} comandos de MODERACIÓN en Discord...`);
    console.log(`📡 Guild ID: ${GUILD_ID}`);
    console.log(`🤖 Client ID: ${CLIENT_ID}`);

    try {
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: moderationCommands }
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
