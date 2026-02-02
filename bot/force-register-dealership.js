require('dotenv').config({ path: __dirname + '/.env' });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { GUILDS } = require('./config/constants');

const DEALERSHIP_TOKEN = process.env.DISCORD_TOKEN_DEALERSHIP;
const TARGET_GUILDS = [GUILDS.MAIN, GUILDS.STAFF].filter(id => id);

if (!DEALERSHIP_TOKEN) {
    console.error('❌ DISCORD_TOKEN_DEALERSHIP no encontrado en .env');
    process.exit(1);
}

const commands = [];

// Cargar comandos de dealership
const dealershipPath = path.join(__dirname, 'commands/dealership');
if (fs.existsSync(dealershipPath)) {
    const commandFiles = fs.readdirSync(dealershipPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(dealershipPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Cargado: dealership/${file} -> /${command.data.name}`);
            } else {
                console.log(`⚠️  [WARNING] ${file} - falta 'data' o 'execute'`);
            }
        } catch (error) {
            console.error(`❌ Error cargando ${file}:`, error.message);
        }
    }
}

console.log(`\n📦 Total de comandos cargados: ${commands.length}\n`);

const rest = new REST({ version: '10' }).setToken(DEALERSHIP_TOKEN);

(async () => {
    try {
        console.log(`🔄 Registrando ${commands.length} comandos en Discord...`);

        const currentUser = await rest.get(Routes.user('@me'));
        console.log(`🤖 Bot: ${currentUser.username}#${currentUser.discriminator} (${currentUser.id})\n`);

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
