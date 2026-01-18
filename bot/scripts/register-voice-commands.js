require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// Cargar comandos de utils (donde están los nuevos comandos de voz)
const utilsPath = path.join(__dirname, '../commands/utils');
const utilsFiles = fs.readdirSync(utilsPath).filter(file => file.endsWith('.js'));

for (const file of utilsFiles) {
    const command = require(path.join(utilsPath, file));
    if (command.data) {
        commands.push(command.data.toJSON());
        console.log(`✅ Cargado: ${command.data.name}`);
    }
}

console.log(`\n📦 Total de comandos cargados: ${commands.length}\n`);

// Registrar comandos
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN_MOD);

(async () => {
    try {
        console.log('🔄 Registrando comandos de voz en Discord...\n');

        const currentUser = await rest.get(Routes.user('@me'));
        const clientId = currentUser.id;

        const guilds = [
            process.env.GUILD_ID,
            '1460059764494041211' // Staff server
        ].filter(Boolean);

        for (const guildId of guilds) {
            console.log(`📡 Registrando en Guild ID: ${guildId}`);

            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );

            console.log(`✅ ${commands.length} comandos registrados en ${guildId}\n`);
        }

        console.log('🎉 ¡Comandos actualizados exitosamente!');
        console.log('\nComandos nuevos disponibles:');
        console.log('- /vc (mejorado)');
        console.log('- /vcreate');
        console.log('- /vcontrol');
        console.log('- /vcstats');
        console.log('- /whisper');

    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();
