const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crash')
        .setDescription('🚀 Únete al juego de Crash y retira antes de que explote')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(50000))
        .addNumberOption(option =>
            option.setName('auto_retiro')
                .setDescription('Multiplicador para retiro automático (ej. 2.0)')
                .setRequired(false)
                .setMinValue(1.01)
                .setMaxValue(100.00)),

    async execute(interaction, client, supabase) {
        const bet = interaction.options.getInteger('apuesta');
        const autoRetiro = interaction.options.getNumber('auto_retiro') || null;

        // Ensure service exists
        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        await interaction.deferReply();

        const result = await casino.joinCrashAndUpdate(interaction, bet, autoRetiro);

        if (!result.success) {
            return interaction.editReply({ content: result.error || '❌ Error al unirse al Crash.' });
        }

        let msg = `✅ **¡Te has unido al Crash!**\n💰 Apuesta: **$${bet.toLocaleString()}**`;
        if (autoRetiro) msg += `\n🎯 Auto-Retiro: **${autoRetiro}x**`;

        if (result.isNew) {
            msg += `\n\n⏳ **Esperando jugadores...** La ronda inicia en 15 segundos.`;
        } else {
            msg += `\n\n⏳ **Esperando inicio de ronda...**`;
        }

        await interaction.editReply({ content: msg });
        // Game logic updates will be handled by CasinoService via interaction.channel.send()
    }
};
