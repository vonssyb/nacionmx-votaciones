/**
 * MODERATION BOT Command Registration Script
 * Usage: node bot/register_moderacion.js
 */

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// ALLOWED CATEGORIES FOR MODERATION BOT
const ALLOWED_CATEGORIES = ['moderation', 'utils'];

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
        'ping', 'info', 'rol', 'licencia', 'sesion', 'ayuda'
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

// LOAD LEGACY COMMANDS (Only if they are moderation related? Assume most legacy are util/mod)
// Actually, in the split, legacy commands are mostly in index.js manually or commands.js.
// We'll skip legacy commands.js for now to avoid pollution, as we are moving to modular.
// Or if the user relies on them, we should include them.
// Given strict split, let's include them ONLY if they are essential. 
// For now, I'll assume modular commands are the priority.

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
const token = process.env.DISCORD_TOKEN; // Original Token
const clientId = process.env.CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('❌ Faltan variables: DISCORD_TOKEN, CLIENT_ID, o GUILD_ID');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
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
