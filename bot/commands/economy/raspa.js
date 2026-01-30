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

        // Logic check: playScratch returns result, update db manually like dice.
        const result = await casino.playScratch(userId, bet);

        const { data: acc } = await supabase.from('casino_chips').select('*').eq('discord_user_id', userId).single();
        if (result.won) {
            const profit = result.payout - bet;
            await supabase.from('casino_chips').update({
                chips_balance: acc.chips_balance + profit, // Implicit deduction handled by adding net profit
                total_won: acc.total_won + profit,
                games_played: acc.games_played + 1
            }).eq('discord_user_id', userId);
        } else {
            await supabase.from('casino_chips').update({
                chips_balance: acc.chips_balance - bet,
                total_lost: acc.total_lost + bet,
                games_played: acc.games_played + 1
            }).eq('discord_user_id', userId);
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
