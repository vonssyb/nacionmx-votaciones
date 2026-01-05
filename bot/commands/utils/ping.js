const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 Ver la latencia del bot con Discord'),

    async execute(interaction, client, supabase) {
        const sent = await interaction.reply({ content: 'Pinging...', withResponse: true, flags: [64] });

        const roundtripLatency = sent.resource.message.createdTimestamp - interaction.createdTimestamp;
        // Check if client.ws exists (it should if passed correctly)
        const wsLatency = (client && client.ws) ? client.ws.ping : -1;

        await interaction.editReply({
            content: `🏓 **Pong!**\n\n📡 Latencia: **${roundtripLatency}ms**\n💓 API Heartbeat: **${wsLatency}ms**`
        });
    }
};
