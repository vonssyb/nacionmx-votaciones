const { REST, Routes, Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
require('dotenv').config();
const { GUILDS } = require('./config/constants');
const loader = require('./handlers/commandLoader');

async function deploy() {
    console.log('🔄 Iniciando despliegue manual de comandos...');

    const client = new Client({ intents: [] });
    client.commands = new Collection();

    // Load Economy Commands
    console.log('📂 Cargando comandos...');
    await loader.loadCommands(client, path.join(__dirname, 'commands'), ['economy', 'business', 'games', 'gov']);

    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

    const token = process.env.DISCORD_TOKEN_ECO;
    const clientId = process.env.CLIENT_ID_ECO || '1336472266850435154'; // Fallback or fetch from token if possible, usually need ID manually or from @me

    if (!token) {
        console.error('❌ No hay DISCORD_TOKEN_ECO en .env');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('🔐 Obteniendo ID de aplicación...');
        const currentUser = await rest.get(Routes.user('@me'));
        const appId = currentUser.id;
        console.log(`🤖 Bot: ${currentUser.username} (${appId})`);

        const guilds = [GUILDS.MAIN, GUILDS.STAFF].filter(g => g);

        console.log(`📡 Registrando ${commands.length} comandos en ${guilds.length} servidores...`);

        for (const guildId of guilds) {
            console.log(`   - Enviando a Guild: ${guildId}`);
            await rest.put(
                Routes.applicationGuildCommands(appId, guildId),
                { body: commands },
            );
        }

        console.log('✅ ¡Comandos actualizados exitosamente!');
    } catch (error) {
        console.error('❌ Error fatal:', error);
    }
}

deploy();
