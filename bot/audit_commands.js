import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load envs
dotenv.config({ path: path.join(__dirname, '../bot/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const BOTS = [
    { name: 'MODERATION', token: process.env.DISCORD_TOKEN_MOD || process.env.DISCORD_BOT_TOKEN },
    { name: 'ECONOMY', token: process.env.DISCORD_TOKEN_ECO },
    { name: 'GOVERNMENT', token: process.env.DISCORD_TOKEN_GOV }
];

const GUILD_ID = process.env.GUILD_ID;

async function audit() {
    console.log('🔍 AUDITING REGISTERED COMMANDS...\n');

    for (const bot of BOTS) {
        if (!bot.token) {
            console.log(`❌ Skipped ${bot.name}: No Token loaded from env`);
            continue;
        }

        // Mask token for log
        const masked = bot.token.substring(0, 5) + '...' + bot.token.substring(bot.token.length - 5);
        console.log(`Debug ${bot.name} Token: ${masked} (Length: ${bot.token.length})`);

        const rest = new REST({ version: '10' }).setToken(bot.token);

        try {
            const user = await rest.get(Routes.user('@me'));
            console.log(`🤖 ${bot.name} BOT: ${user.username} (ID: ${user.id})`);

            // Check Global
            const globalCmds = await rest.get(Routes.applicationCommands(user.id));
            console.log(`   🌍 Global Commands (${globalCmds.length}):`);
            globalCmds.forEach(c => console.log(`      - /${c.name} (ID: ${c.id})`));

            // Check Guild
            if (GUILD_ID) {
                const guildCmds = await rest.get(Routes.applicationGuildCommands(user.id, GUILD_ID));
                console.log(`   🏰 Guild Commands (${guildCmds.length}):`);
                guildCmds.forEach(c => console.log(`      - /${c.name} (ID: ${c.id})`));
            } else {
                console.log('   ⚠️ No Guild ID to check guild commands.');
            }
            console.log('--------------------------------------------------');

        } catch (e) {
            console.error(`❌ Error checking ${bot.name}:`, e.message);
        }
    }
}

audit();
