const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('videopoker')
        .setDescription('🃏 Juega Video Poker (Jacks or Better)')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(50000)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('apuesta');

        const casino = new CasinoService(supabase); // Use existing service instance if possible, but new is fine if stateless or uses DB for checking
        // Actually, CasinoService holds state in `this.sessions`. Since we need state persistence across buttons, we must use the GLOBAL casino service instance attached to client.
        // client.services.casino should exist or client.casinoService.

        const globalCasino = client.casinoService || client.services.casino;

        if (!globalCasino) {
            return interaction.editReply({ content: '❌ Error interno: Servicio de Casino no disponible.' });
        }

        // Check chips
        const check = await globalCasino.checkChips(userId, betAmount);
        if (!check.hasEnough) return interaction.editReply({ content: check.message, ephemeral: true });

        // Deduct chips immediately
        await globalCasino.removeChips(userId, betAmount);

        // Start Game
        await globalCasino.startVideoPoker(interaction, betAmount);
    }
};
