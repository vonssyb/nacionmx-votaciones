/**
 * Manual Command Registration Script for Discord
 * Run this locally to register /status and /ayuda commands
 * 
 * Usage: node bot/register_commands.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// Dynamic Command Loading from Folders
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.lstatSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                // Check for duplicates before pushing
                const cmdName = command.data.name;
                if (commands.some(c => c.name === cmdName)) {
                    console.warn(`[WARN] Comando duplicado omitido: ${cmdName} (${file})`);
                } else {
                    commands.push(command.data.toJSON());
                    console.log(`[LOAD] Copiando comando modular: ${cmdName}`);
                }
            } else {
                console.warn(`[WARN] El comando en ${filePath} le falta 'data' o 'execute'.`);
            }
        } catch (error) {
            console.error(`[ERR] Error cargando comando ${file}:`, error);
        }
    }
}

// LOAD LEGACY COMMANDS from commands.js
try {
    const legacyCommandsModule = require('./commands.js');
    // commands.js exports an array directly or { commands: [] }? check file. 
    // It seems to be `const commands = [...]` but need to see how it exports.
    // If it's not exported, I can't require it. 
    // Let's assume it exports 'commands' or is an array export.
    // I recall commands.js usually ends with module.exports = commands;

    // Check if duplicate before adding
    const legacyCommands = Array.isArray(legacyCommandsModule) ? legacyCommandsModule : legacyCommandsModule.commands;

    if (legacyCommands) {
        let legacyCount = 0;
        const EXCLUDED_LEGACY = ['multa', 'tarjeta', 'saldo', 'robar', 'bolsa', 'casino', 'info', 'notificaciones', 'impuestos', 'nomina', 'giro', 'movimientos', 'top-morosos', 'top-ricos', 'slots', 'stake', 'dar-robo', 'fondos'];
        for (const cmd of legacyCommands) {
            // Only add if not already present AND not excluded
            if (!commands.find(c => c.name === cmd.name) && !EXCLUDED_LEGACY.includes(cmd.name)) {
                commands.push(cmd);
                legacyCount++;
            }
        }
        console.log(`[LOAD] Importados ${legacyCount} comandos legacy de commands.js`);
    }
} catch (err) {
    console.warn('[WARN] No se pudo cargar bot/commands.js legacy:', err.message);
}

// Add manual commands if needed (or move them to files)
// For now, keeping status/ayuda if they aren't in files yet.
// Checking if 'status' exists in loaded commands
if (!commands.find(c => c.name === 'status')) {
    commands.push(
        new SlashCommandBuilder()
            .setName('status')
            .setDescription('Ver el estado del bot y estadísticas del sistema')
            .toJSON()
    );
}

if (!commands.find(c => c.name === 'ayuda')) {
    commands.push(
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
    );
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('🚀 Registrando comandos en Discord...');
        console.log(`📋 Comandos a registrar: ${commands.length}`);

        const clientId = process.env.CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
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
const clientId = process.env.CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;

if (!process.env.DISCORD_TOKEN || !clientId || !process.env.GUILD_ID) {
    console.error('❌ Error: Faltan variables de entorno requeridas:');
    console.error('   - DISCORD_TOKEN');
    console.error('   - CLIENT_ID (o VITE_DISCORD_CLIENT_ID)');
    console.error('   - GUILD_ID');
    console.error('\n💡 Asegúrate de tener un archivo .env con estas variables.');
    process.exit(1);
}

registerCommands();
