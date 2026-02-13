const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raspa')
        .setDescription('🎫 Raspa y gana premios instantáneos')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(2000)),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');

        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Atomic Transaction Execution
        const result = await casino.playScratchAndUpdate(userId, bet);

        if (result.error) {
            return interaction.reply({ content: `❌ Error en la transacción: ${result.error}`, ephemeral: true });
        }

        // Visualize Grid
        let gridStr = '';
        for (let i = 0; i < 9; i++) {
            gridStr += `|| ${result.grid[i]} || `;
            if ((i + 1) % 3 === 0) gridStr += '\n';
        }

        const embed = new EmbedBuilder()
            .setTitle(result.won ? '🎉 ¡GANASTE!' : '😢 Suerte la próxima')
            .setDescription(`**RASPITO NACIONMX**\n\n${gridStr}\nApuesta: **${bet}**\n${result.won ? `Premio: **${result.payout}** (3x ${result.match})` : 'No hubo coincidencias.'}`)
            .setColor(result.won ? '#F1C40F' : '#95A5A6');

        await interaction.reply({ embeds: [embed] });
    }
};
