const { Client, GatewayIntentBits, AuditLogEvent } = require('discord.js');
require('dotenv').config({ path: 'bot/.env' }); // Adjust path for CWD root execution

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guildId = process.env.GUILD_ID; // Ensure this is set or hardcode main guild
    if (!guildId) {
        console.error('No GUILD_ID in env');
        process.exit(1);
    }

    const guild = await client.guilds.fetch(guildId);
    console.log(`Checking Audit Logs for: ${guild.name}`);

    try {
        const logs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MessageDelete,
            limit: 10
        });

        console.log(`\n--- Last 10 Message Deletions ---`);
        logs.entries.forEach(entry => {
            const date = entry.createdAt.toLocaleString();
            const executor = entry.executor ? entry.executor.tag : 'Unknown';
            const target = entry.target ? entry.target.tag : 'Unknown';
            // extra details if available
            console.log(`[${date}] Deleted by: ${executor} | Target Author: ${target} | Reason: ${entry.reason || 'None'}`);
        });

        const autoModLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.AutoModerationBlockMessage,
            limit: 5
        });

        console.log(`\n--- Last 5 AutoMod Blocks ---`);
        autoModLogs.entries.forEach(entry => {
            console.log(`[${entry.createdAt.toLocaleString()}] Blocked by AutoMod | Rule: ${entry.extra?.autoModerationRuleName || 'Unknown'}`);
        });

    } catch (e) {
        console.error('Error fetching logs:', e);
    }

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN_MOD);
