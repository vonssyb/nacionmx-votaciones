const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { REST, Routes } = require('discord.js');

const BOTS = [
    { name: 'ECONOMY', token: process.env.DISCORD_TOKEN_ECO },
    { name: 'GOV', token: process.env.DISCORD_TOKEN_GOV },
    { name: 'MOD', token: process.env.DISCORD_TOKEN_MOD },
    { name: 'DEALERSHIP', token: process.env.DISCORD_TOKEN_DEALERSHIP }
];

(async () => {
    for (const bot of BOTS) {
        if (!bot.token) {
            console.log(`❌ [${bot.name}] No token found. Skipping.`);
            continue;
        }

        const rest = new REST({ version: '10' }).setToken(bot.token);

        try {
            console.log(`🧹 [${bot.name}] Fetching global commands...`);
            const currentUser = await rest.get(Routes.user('@me'));
            const clientId = currentUser.id;

            // Fetch current global commands
            const commands = await rest.get(Routes.applicationCommands(clientId));
            console.log(`🔍 [${bot.name}] Found ${commands.length} global commands.`);

            if (commands.length > 0) {
                console.log(`🗑️ [${bot.name}] Deleting all global commands...`);
                // Set global commands to empty array -> Deletes them all
                await rest.put(Routes.applicationCommands(clientId), { body: [] });
                console.log(`✅ [${bot.name}] Global commands cleared.`);
            } else {
                console.log(`✅ [${bot.name}] No global commands to clear.`);
            }

        } catch (error) {
            console.error(`❌ [${bot.name}] Error clearing commands:`, error);
        }
    }
})();
