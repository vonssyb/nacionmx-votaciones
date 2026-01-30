const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dados')
        .setDescription('🎲 Lanza los dados y gana')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de apuesta')
                .setRequired(true)
                .addChoices(
                    { name: '🎲 7 Exacto (x4)', value: '7' },
                    { name: '🔼 Mayor a 7 (x2)', value: 'over_7' },
                    { name: '🔽 Menor a 7 (x2)', value: 'under_7' },
                    { name: '🔢 Par (x2)', value: 'even' },
                    { name: '🔣 Impar (x2)', value: 'odd' },
                    { name: '👯 Dobles (x5)', value: 'doubles' }
                )),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const type = interaction.options.getString('tipo');

        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Deduct bet (Optimistic UI handled by service update? No, service playDice just returns result)
        // Need to update DB here or in Service. Service is Instant return, so update here.

        // Wait, playDice is pure logic? 
        // Let's check playDice definition I wrote.
        // It returns result object using random numbers. It does NOT update DB.

        const result = await casino.playDice(userId, bet, type);

        // Update DB
        const { data: acc } = await supabase.from('casino_chips').select('*').eq('discord_user_id', userId).single();
        if (result.won) {
            const profit = result.payout - bet;
            await supabase.from('casino_chips').update({
                chips_balance: acc.chips_balance + profit, // Add profit (bet was not deducted yet? Wait.)
                // If I didn't deduct bet: balance + payout - bet.
                // Or balance + profit.
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

        // Visualize
        await casino.animateDice(interaction);

        const embed = new EmbedBuilder()
            .setTitle(`🎲 DADOS: ${result.sum}`)
            .setDescription(`🎲 ${result.d1} | 🎲 ${result.d2}\n\nApuesta: **${type.toUpperCase()}**\nResultado: **${result.won ? '✅ GANASTE' : '❌ PERDISTE'}**\n${result.won ? `Premio: **${result.payout}** fichas` : `Perdiste: **${bet}** fichas`}`)
            .setColor(result.won ? '#2ECC71' : '#E74C3C');

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};
