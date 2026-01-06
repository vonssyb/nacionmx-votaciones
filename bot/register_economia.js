/**
 * ECONOMY BOT Command Registration Script
 * Usage: node bot/register_economia.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// ALLOWED CATEGORIES FOR ECONOMY BOT
// Corrected based on 'ls bot/commands': economy, business, games, utils
// We keep this if you move to modules later.
const ALLOWED_CATEGORIES = ['economy', 'business', 'games'];

// 1. DYNAMIC LOADING (Modular)
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        if (!ALLOWED_CATEGORIES.includes(folder)) continue;
        const folderPath = path.join(commandsPath, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                }
            } catch (error) { console.error(`[ERR] ${file}:`, error); }
        }
    }
}

// 2. LEGACY LOADING (commands.js)
try {
    const legacyCommands = require('./commands.js');
    const ECO_LEGACY = [
        'fichar', 'registrar-tarjeta', 'tarjeta', 'credito', 'depositar',
        'giro', 'movimientos', 'notificaciones', 'top-morosos', 'top-ricos',
        'tienda', 'inversion', 'impuestos', 'empresa', 'robar', 'trabajar',
        'bolsa', 'crimen', 'casino', 'nomina', 'dar-robo', 'stake', 'slots',
        'fondos', 'balanza', 'saldo', 'jugar'
    ];

    legacyCommands.forEach(cmd => {
        if (ECO_LEGACY.includes(cmd.name)) {
            // Avoid duplicates if modular already loaded it
            if (!commands.find(c => c.name === cmd.name)) {
                commands.push(cmd);
                console.log(`[ECO] Legacy cargado: ${cmd.name}`);
            }
        }
    });
} catch (e) {
    console.warn('[WARN] No se pudo cargar commands.js legacy', e.message);
}

// Manual commands specific to Economy
if (!commands.find(c => c.name === 'balanza')) {
    // Add if missing
}

// TOKEN & CLIENT ID for ECONOMY
// 1. Try generic vars for flexibility
// 2. Try specific ECO vars
const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN_ECO || process.env.DISCORD_TOKEN;
// Auto-extract Client ID from Token if not provided
let clientId = process.env.CLIENT_ID_ECO;

if (!clientId && token) {
    try {
        const base64Id = token.split('.')[0];
        const buff = Buffer.from(base64Id, 'base64');
        clientId = buff.toString('ascii');
        console.log(`ℹ️ [ECO] Client ID extraído del token: ${clientId}`);
    } catch (e) {
        console.warn('⚠️ No se pudo extraer Client ID del token.');
    }
}

const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('❌ Faltan variables: DISCORD_BOT_TOKEN/DISCORD_TOKEN_ECO, CLIENT_ID_ECO, o GUILD_ID');
    console.error('   Si no tienes CLIENT_ID_ECO, asegúrate que el token sea válido para extraerlo.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 [ECO] Registrando ${commands.length} comandos...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ [ECO] ${data.length} comandos registrados para App ID ${clientId}`);
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ [ECO] Error:', error);
    }
})();
