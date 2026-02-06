const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('penales')
        .setDescription('⚽ Tanda de penales (x1.5)')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000)),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');

        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Deduct here or inside startPenalty?
        // startPenalty sets session. Inside handleInteraction we apply result.
        // It's safer to deduct NOW to prevent spam/exploit.

        await supabase.from('casino_chips').update({ chips: check.balance - bet }).eq('user_id', userId);

        await casino.startPenalty(interaction, bet);
    }
};
