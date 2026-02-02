require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { GUILDS } = require('./config/constants');

const MOD_TOKEN = process.env.DISCORD_TOKEN_MOD;
const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

if (!MOD_TOKEN) {
    console.error('❌ DISCORD_TOKEN_MOD no encontrado en .env');
    process.exit(1);
}

const commands = [];

// Cargar comandos de las carpetas
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = ['moderation', 'utils', 'owner', 'tickets'];

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    if (!fs.existsSync(commandsPath)) continue;

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Cargado: ${folder}/${file} -> /${command.data.name}`);
            } else {
                console.log(`⚠️  [WARNING] ${file} - falta 'data' o 'execute'`);
            }
        } catch (error) {
            console.error(`❌ Error cargando ${file}:`, error.message);
        }
    }
}

console.log(`\n📦 Total de comandos cargados: ${commands.length}\n`);

// Construir REST module y registrar comandos
const rest = new REST({ version: '10' }).setToken(MOD_TOKEN);

(async () => {
    try {
        console.log(`🔄 Registrando ${commands.length} comandos en Discord...`);

        // Obtener el ID del bot
        const currentUser = await rest.get(Routes.user('@me'));
        console.log(`🤖 Bot: ${currentUser.username}#${currentUser.discriminator} (${currentUser.id})\n`);

        // Registrar en todos los servidores configurados
        for (const guildId of TARGET_GUILDS) {
            try {
                console.log(`📡 Registrando en servidor ${guildId}...`);
                const data = await rest.put(
                    Routes.applicationGuildCommands(currentUser.id, guildId),
                    { body: commands },
                );
                console.log(`✅ Registrados ${data.length} comandos en guild ${guildId}\n`);
            } catch (guildError) {
                console.error(`❌ Error en guild ${guildId}:`, guildError.message);
            }
        }

        console.log('\n✅ ¡Proceso completado!');
        console.log('\n📋 Lista de comandos:');
        commands.forEach(cmd => console.log(`   - /${cmd.name}`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error general:', error);
        process.exit(1);
    }
})();
