const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minas')
        .setDescription('💣 Jugar a las Minas (Alta Emoción)')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000))
        .addIntegerOption(option =>
            option.setName('cantidad_minas')
                .setDescription('Número de minas (1-19)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(19)), // Max 19 because 20 cells, need at least 1 safe

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const mines = interaction.options.getInteger('cantidad_minas');

        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        // Check if already playing
        if (casino.sessions.mines[userId]) {
            return interaction.reply({ content: '❌ Ya tienes un juego de Minas activo. Termínalo antes de empezar otro.', ephemeral: true });
        }

        // Check chips & Start Game Atomically
        await interaction.deferReply();

        const result = await casino.startMinesAndUpdate(interaction, bet, mines);

        if (!result.success) {
            return interaction.editReply({ content: result.error || '❌ Error al iniciar el juego.' });
        }
    }
};
