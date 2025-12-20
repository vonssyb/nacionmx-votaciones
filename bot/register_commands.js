/**
 * Manual Command Registration Script for Discord
 * Run this locally to register /status and /ayuda commands
 * 
 * Usage: node bot/register_commands.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    // /status command
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Ver el estado del bot y estadísticas del sistema')
        .toJSON(),

    // /ayuda command with categories
    new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('Sistema de ayuda interactivo con categorías')
        .addStringOption(option =>
            option.setName('categoria')
                .setDescription('Categoría de comandos')
                .setRequired(false)
                .addChoices(
                    { name: '💳 Tarjetas', value: 'cards' },
                    { name: '💰 Transacciones', value: 'transactions' },
                    { name: '🏢 Empresas', value: 'companies' },
                    { name: '🎰 Casino', value: 'casino' },
                    { name: '📊 Información', value: 'info' }
                ))
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('🚀 Registrando comandos en Discord...');
        console.log(`📋 Comandos a registrar: ${commands.length}`);

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );

        console.log(`✅ ${data.length} comandos registrados exitosamente!`);
        console.log('✨ Comandos disponibles:');
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        if (error.code === 50001) {
            console.log('\n⚠️ Error: Missing Access. El bot necesita permisos de "applications.commands"');
        }
    }
}

// Validate environment variables
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('❌ Error: Faltan variables de entorno requeridas:');
    console.error('   - DISCORD_TOKEN');
    console.error('   - CLIENT_ID');
    console.error('   - GUILD_ID');
    console.error('\n💡 Asegúrate de tener un archivo .env con estas variables.');
    process.exit(1);
}

registerCommands();
