// Manual Command Registration Script - REGISTER ALL COMMANDS
// Run this from your PC to register/update Discord slash commands

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { REST, Routes } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN || !GUILD_ID || !CLIENT_ID) {
    console.error('❌ ERROR: DISCORD_TOKEN, GUILD_ID y CLIENT_ID son requeridos en .env');
    process.exit(1);
}

// Import the commands directly from commands.js
const commands = require('./commands');

console.log(`✅ Cargados ${commands.length} comandos de commands.js`);

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
        console.log('🔄 Registrando TODOS los comandos en Discord...');
        console.log(`📡 Guild ID: ${GUILD_ID}`);
        console.log(`🎮 Comandos a registrar: ${commands.length}`);

        // Register to specific guild (instant updates)
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log(`✅ ${data.length} comandos registrados exitosamente!`);
        console.log('🎉 Los comandos deberían aparecer instantáneamente en Discord.');
        console.log('\n📋 Comandos registrados:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);

        if (error.code === 50001) {
            console.log('\n💡 SOLUCIÓN: Verifica que CLIENT_ID sea correcto.');
            console.log('   Obtén tu CLIENT_ID desde: https://discord.com/developers/applications');
        } else if (error.code === 50035) {
            console.log('\n💡 Error de validación en comandos. Detalles:', error.rawError);
        }
        process.exit(1);
    }
}

registerCommands();
