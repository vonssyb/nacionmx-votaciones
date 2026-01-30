const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

const SYMBOLS = ['🍒', '🍋', '🍊', '🍉', '💎', '7️⃣', '🎰'];
const WEIGHTS = [35, 25, 15, 10, 8, 5, 2]; // Probabilities (sum 100)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tragamonedas')
        .setDescription('🎰 Jugar al tragamonedas (Slots)')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000)),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');

        // Load CasinoService (assuming it's available on client or we instantiate new)
        const casino = new CasinoService(supabase);

        // Check balance
        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Deduct bet immediately
        await supabase.from('casino_chips')
            .update({
                chips_balance: check.balance - bet,
                updated_at: new Date().toISOString()
            })
            .eq('discord_user_id', userId);

        await interaction.reply({ content: '🎰 Tirando de la palanca...' });

        // Spin logic
        const spinReel = () => {
            const rand = Math.random() * 100;
            let sum = 0;
            for (let i = 0; i < SYMBOLS.length; i++) {
                sum += WEIGHTS[i];
                if (rand < sum) return SYMBOLS[i];
            }
            return SYMBOLS[0];
        };

        const result = [spinReel(), spinReel(), spinReel()];

        // Animation
        await casino.animateSlots(interaction, result);

        // Calculate payout
        let payout = 0;
        let multiplier = 0;

        if (result[0] === result[1] && result[1] === result[2]) {
            // Three of a kind
            const sym = result[0];
            if (sym === '🎰') multiplier = 100;
            else if (sym === '7️⃣') multiplier = 50;
            else if (sym === '💎') multiplier = 25;
            else if (sym === '🍉') multiplier = 15;
            else if (sym === '🍊') multiplier = 10;
            else if (sym === '🍋') multiplier = 7;
            else if (sym === '🍒') multiplier = 5;
        } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
            // Two of a kind (small prize)
            multiplier = 2;
        }

        payout = bet * multiplier;
        const netProfit = payout - bet;

        // Update DB with result
        if (payout > 0) {
            const { data: acc } = await supabase.from('casino_chips').select('chips_balance, total_won').eq('discord_user_id', userId).single();
            await supabase.from('casino_chips').update({
                chips_balance: acc.chips_balance + payout,
                total_won: (acc.total_won || 0) + payout,
                games_played: (check.gamesPlayed || 0) + 1 // Actually need to re-fetch or increment
            }).eq('discord_user_id', userId);
        } else {
            const { data: acc } = await supabase.from('casino_chips').select('total_lost').eq('discord_user_id', userId).single();
            await supabase.from('casino_chips').update({
                total_lost: (acc.total_lost || 0) + bet
            }).eq('discord_user_id', userId);
        }

        // Increment games played
        await supabase.rpc('increment_casino_games', { user_id_param: userId }); // Or just raw update if RPC not exists

        const embed = new EmbedBuilder()
            .setTitle('🎰 TRAGAMONEDAS')
            .setDescription(`**${result.join(' | ')}**`)
            .setColor(payout > 0 ? '#2ECC71' : '#E74C3C')
            .addFields(
                { name: 'Apuesta', value: `${bet}`, inline: true },
                { name: 'Resultado', value: payout > 0 ? `✅ Ganaste **${payout}** (${multiplier}x)` : '❌ Perdiste', inline: true }
            );

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};
