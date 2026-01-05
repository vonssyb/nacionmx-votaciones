/**
 * MODERATION BOT Command Registration Script
 * Usage: node bot/register_moderacion.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load env from both locations to be safe
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// ALLOWED CATEGORIES FOR MODERATION BOT (Strict)
const ALLOWED_CATEGORIES = ['moderation'];

// 1. DYNAMIC LOADING
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        // FILTER: Only allowed categories
        if (!ALLOWED_CATEGORIES.includes(folder)) continue;

        const folderPath = path.join(commandsPath, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            // CONFLICT FIX: Skip ayuda.js from utils because moderation has its own ayuda.js
            if (folder === 'utils' && file === 'ayuda.js') continue;

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

// 2. LEGACY LOADING
try {
    const legacyCommands = require('./commands.js');
    const MOD_LEGACY = [
        'ping', 'info', 'sesion', 'ayuda'
    ];

    legacyCommands.forEach(cmd => {
        if (MOD_LEGACY.includes(cmd.name)) {
            if (!commands.find(c => c.name === cmd.name)) {
                commands.push(cmd);
                console.log(`[MOD] Legacy cargado: ${cmd.name}`);
            }
        }
    });
} catch (e) { console.warn('[WARN] Legacy load failed', e); }

// Manual commands specific to Moderation
if (!commands.find(c => c.name === 'status')) {
    commands.push(
        new SlashCommandBuilder()
            .setName('status')
            .setDescription('Ver el estado del bot de MODERACIÓN')
            .toJSON()
    );
}

// TOKEN & CLIENT ID for MODERATION
const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
let clientId = process.env.CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !guildId) {
    console.error('❌ Faltan variables: DISCORD_TOKEN/DISCORD_BOT_TOKEN o GUILD_ID');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        // Fetch Client ID if missing or invalid suspect
        if (!clientId) {
            console.log('⚠️ CLIENT_ID no encontrado. Obteniendo de la API...');
            const currentUser = await rest.get(Routes.user('@me'));
            clientId = currentUser.id;
            console.log(`✅ Client ID obtenido: ${clientId} (${currentUser.username})`);
        }

        console.log(`🚀 [MOD] Registrando ${commands.length} comandos...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ [MOD] ${data.length} comandos registrados para App ID ${clientId}`);
        data.forEach(cmd => console.log(`   - /${cmd.name}`));

    } catch (error) {
        console.error('❌ [MOD] Error:', error);
    }
})();
