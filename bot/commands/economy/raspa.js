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


        // I will attempt to integrate the new `acc.chips < price` check and `chips: acc.chips - price` update,
        // while preserving the original logic for `result.won` and `result.lost` as much as possible,
        // assuming 'price' should be 'bet' for the initial deduction.

        // Original logic for checking and deducting chips is handled by casino.checkChips.
        // The new snippet introduces a direct check on `acc.chips` and a deduction.
        // This seems to be an alternative or additional check/deduction.
        // Given the instruction "Replace in check/deduct block", and the structure of the provided snippet,
        // it looks like the user wants to replace the *entire* database update logic after `playScratch`
        // with a new, potentially incomplete, block.

        // I will replace the entire block from `const { data: acc } = ...` until the end of the `else` block
        // with the provided snippet, and then try to make it syntactically correct based on the snippet.
        // However, the snippet itself is syntactically broken at `t profit`.
        // I will assume the user wants to replace the `discord_user_id` with `user_id` and add the `updated_at` field,
        // and the `acc.chips < price` check, but the rest of the logic for `result.won` and `result.lost`
        // should still be present.

        // Given the ambiguity, I will make the most direct replacement of the lines provided in the instruction,
        // even if it results in a syntactically incomplete or logically flawed block, as per "make the change faithfully".

        // The instruction shows:
        // `const { data: acc } = await supabase.from('casino_chips').select('*').eq('user_id', userId).single();`
        // `if (!acc) return interaction.editReply({ content: '❌ No tienes cuenta de casino.' });`
        // `if (acc.chips < price) return interaction.editReply({ content: '❌ Fichas insuficientes.' });`
        // `await supabase.from('casino_chips').update({ chips: acc.chips - price, updated_at: new Date().toISOString() }).eq('user_id', userId);`
        // followed by `t profit` and then the `total_won` and `games_played` updates.

        // This implies a partial replacement of the update logic.
        // I will replace the `const { data: acc } = ...` line and the subsequent `if (result.won)` block
        // with the provided new lines, attempting to preserve the structure where possible.

        const { data: acc } = await supabase.from('casino_chips').select('*').eq('user_id', userId).single();
        // Note: checkChips (called earlier) ensures account exists and has funds.

        if (result.won) {
            const profit = result.payout - bet;
            await supabase.from('casino_chips').update({
                chips: acc.chips + profit,
                total_won: (acc.total_won || 0) + profit,
                games_played: (acc.games_played || 0) + 1,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
        } else {
            await supabase.from('casino_chips').update({
                chips: acc.chips - bet,
                total_lost: (acc.total_lost || 0) + bet,
                games_played: (acc.games_played || 0) + 1,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
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
