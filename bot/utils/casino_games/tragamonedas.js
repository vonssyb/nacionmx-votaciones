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
        await interaction.deferReply();
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');

        // Load Service
        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        // Check balance
        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.editReply({ content: check.message, ephemeral: true });

        // Animation Frames
        const frames = [
            { text: '**[ ❓ | ❓ | ❓ ]**\n\n> 🎰 Tirando de la palanca...', delay: 1000 },
            { text: '**[ 🍒 | ❓ | ❓ ]**\n\n> ⏳ Primer rodillo...', delay: 2000 },
            { text: '**[ 🍒 | 🍋 | ❓ ]**\n\n> ⏳ Segundo rodillo...', delay: 3000 }
        ];

        // Play Animation
        const embed = new EmbedBuilder()
            .setTitle('🎰 TRAGAMONEDAS')
            .setColor('#3498DB');

        for (const frame of frames) {
            embed.setDescription(frame.text);
            await interaction.editReply({ embeds: [embed] }).catch(() => { });
            await new Promise(r => setTimeout(r, 1000));
        }

        // Execute Atomic Transaction
        const result = await casino.playSlotsAndUpdate(userId, bet);

        if (result.error) {
            return interaction.editReply({ content: result.error, embeds: [] });
        }

        // Final Result
        const finalEmbed = new EmbedBuilder()
            .setTitle('🎰 TRAGAMONEDAS: RESULTADO')
            .setDescription(`**[ ${result.symbols[0]} | ${result.symbols[1]} | ${result.symbols[2]} ]**\n\n${result.matchType ? `✨ Jugada: **${result.matchType}**` : ''}`)
            .setColor(result.won ? '#2ECC71' : '#E74C3C')
            .addFields(
                { name: 'Apuesta', value: `${bet}`, inline: true },
                { name: 'Ganancia', value: result.won ? `✅ +${result.payout}` : '❌ 0', inline: true },
                { name: 'Balance', value: `💰 ${result.newBalance ? result.newBalance.toLocaleString() : '---'}`, inline: true }
            );

        await interaction.editReply({ embeds: [finalEmbed] });
    }
};
