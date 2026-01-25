require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const CHANNEL_ID = '1449946577149100315';

client.once('ready', async () => {
    console.log(`🤖 Debug Bot logged in as ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        console.log(`✅ Channel Found: ${channel.name} (${channel.type})`);
        console.log(`   Guild: ${channel.guild.name}`);

        // Check Permissions
        const permissions = channel.permissionsFor(client.user);
        const hasView = permissions.has(PermissionFlagsBits.ViewChannel);
        const hasSend = permissions.has(PermissionFlagsBits.SendMessages);
        const hasManage = permissions.has(PermissionFlagsBits.ManageMessages);
        const hasEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

        console.log(`🔒 Permissions Check:`);
        console.log(`   - View Channel: ${hasView ? '✅' : '❌'}`);
        console.log(`   - Send Messages: ${hasSend ? '✅' : '❌'}`);
        console.log(`   - Manage Messages (Delete): ${hasManage ? '✅' : '❌'}`);
        console.log(`   - Embed Links: ${hasEmbed ? '✅' : '❌'}`);

        if (!hasManage) {
            console.error('⚠️ CRITICAL: Bot cannot delete messages in this channel!');
        }

    } catch (error) {
        console.error('❌ Failed to fetch channel:', error.message);
        if (error.code === 10003) console.error('   -> Unknown Channel. ID might be wrong or bot is not in the guild.');
        if (error.code === 50001) console.error('   -> Missing Access to the guild or channel.');
    }

    // Wait 5 seconds then exit
    setTimeout(() => process.exit(0), 5000);
});

client.login(process.env.DISCORD_TOKEN_MOD);
