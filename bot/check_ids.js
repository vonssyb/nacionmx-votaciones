
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function checkBots() {
    const tokens = {
        'DISCORD_TOKEN': process.env.DISCORD_TOKEN,
        'DISCORD_BOT_TOKEN': process.env.DISCORD_BOT_TOKEN,
        'DISCORD_TOKEN_ECO': process.env.DISCORD_TOKEN_ECO
    };

    for (const [name, token] of Object.entries(tokens)) {
        if (!token) {
            console.log(`${name}: Not set`);
            continue;
        }
        const client = new Client({ intents: [GatewayIntentBits.Guilds] });
        try {
            await client.login(token);
            console.log(`${name}: ID=${client.user.id}, Tag=${client.user.tag}`);
            await client.destroy();
        } catch (err) {
            console.log(`${name}: Error - ${err.message}`);
        }
    }
}

checkBots();
