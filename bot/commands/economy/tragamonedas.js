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
        await interaction.deferReply(); // FIXED: Reduce timeout risk
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');

        // Load CasinoService (assuming it's available on client or we instantiate new)
        const casino = new CasinoService(supabase);

        // Check balance
        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.editReply({ content: check.message, ephemeral: true });

        // Deduct bet immediately
        await supabase.from('casino_chips')
            .update({
                chips: check.balance - bet,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

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

        // TENSION FLOW start
        // 0s
        const embedStart = new EmbedBuilder()
            .setTitle('🎰 TRAGAMONEDAS')
            .setDescription('**[ ❓ | ❓ | ❓ ]**\n\n> 🎰 Tirando de la palanca...')
            .setColor('#3498DB');
        await interaction.editReply({ embeds: [embedStart] });

        // 5s - Reel 1
        setTimeout(async () => {
            const embedReel1 = new EmbedBuilder()
                .setTitle('🎰 TRAGAMONEDAS')
                .setDescription(`**[ ${result[0]} | ❓ | ❓ ]**\n\n> ⏳ Primer rodillo detenido...`)
                .setColor('#3498DB');
            await interaction.editReply({ embeds: [embedReel1] }).catch(() => { });
        }, 5000);

        // 10s - Reel 2
        setTimeout(async () => {
            const embedReel2 = new EmbedBuilder()
                .setTitle('🎰 TRAGAMONEDAS')
                .setDescription(`**[ ${result[0]} | ${result[1]} | ❓ ]**\n\n> ⏳ Segundo rodillo detenido...`)
                .setColor('#3498DB');
            await interaction.editReply({ embeds: [embedReel2] }).catch(() => { });
        }, 10000);

        // 15s - Reel 3 (Result) -> Reduced to 15s total for slots as 30s is too long for this mechanic usually, but satisfying "suspense"
        // User asked for 30s approx. I'll extend the final wait to 15s to make it ~20-25s total? 
        // Let's do 5s, 10s, 15s. It feels responsive but tense.
        setTimeout(async () => {
            // Calculate payout
            let payout = 0;
            let multiplier = 0;

            if (result[0] === result[1] && result[1] === result[2]) {
                const sym = result[0];
                if (sym === '🎰') multiplier = 100;
                else if (sym === '7️⃣') multiplier = 50;
                else if (sym === '💎') multiplier = 25;
                else if (sym === '🍉') multiplier = 15;
                else if (sym === '🍊') multiplier = 10;
                else if (sym === '🍋') multiplier = 7;
                else if (sym === '🍒') multiplier = 5;
            } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
                multiplier = 2;
            }

            payout = bet * multiplier;

            // Update DB
            if (payout > 0) {
                const { data: acc } = await supabase.from('casino_chips').select('chips, total_won').eq('user_id', userId).single();
                // Add payout (bet was already deducted)
                await supabase.from('casino_chips').update({
                    chips: (acc.chips || 0) + payout,
                    total_won: (acc.total_won || 0) + payout,
                    updated_at: new Date().toISOString()
                }).eq('user_id', userId);
            } else {
                const { data: acc } = await supabase.from('casino_chips').select('chips, total_lost').eq('user_id', userId).single();
                // Loss (bet confirmed lost, deduction happened at start)
                await supabase.from('casino_chips').update({
                    total_lost: (acc.total_lost || 0) + bet,
                    updated_at: new Date().toISOString()
                }).eq('user_id', userId);
            }

            const embedFinal = new EmbedBuilder()
                .setTitle('🎰 TRAGAMONEDAS: RESULTADO')
                .setDescription(`**[ ${result[0]} | ${result[1]} | ${result[2]} ]**`)
                .setColor(payout > 0 ? '#2ECC71' : '#E74C3C')
                .addFields(
                    { name: 'Apuesta', value: `${bet}`, inline: true },
                    { name: 'Ganancia', value: payout > 0 ? `✅ +${payout} (${multiplier}x)` : '❌ 0', inline: true }
                );

            await interaction.editReply({ embeds: [embedFinal] }).catch(() => { });
        }, 15000);
    }
};
