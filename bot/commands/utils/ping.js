const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 Ver la latencia del bot con Discord'),

    async execute(interaction, client, supabase) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, ephemeral: true });

        const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = client.ws.ping;

        await interaction.editReply({
            content: `🏓 **Pong!**\n\n📡 Latencia: **${roundtripLatency}ms**\n💓 API Heartbeat: **${wsLatency}ms**`
        });
    }
};
