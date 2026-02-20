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

        // Check balance
        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) {
            return interaction.reply({ content: check.message, ephemeral: true });
        }

        // Defer reply for animation
        await interaction.deferReply();

        // Animate dice roll
        await casino.animateDice(interaction);

        // Execute game with atomic transaction
        const result = await casino.playDiceAndUpdate(userId, bet, type);

        // Handle errors
        if (result.error) {
            return interaction.editReply({ content: result.error });
        }

        // Build result embed
        const embed = new EmbedBuilder()
            .setTitle(`🎲 DADOS: ${result.sum}`)
            .setDescription(
                `🎲 ${result.d1} | 🎲 ${result.d2}\n\n` +
                `Apuesta: **${type.toUpperCase()}**\n` +
                `Resultado: **${result.won ? '✅ GANASTE' : '❌ PERDISTE'}**\n` +
                `${result.won ? `Premio: **${result.payout}** fichas` : `Perdiste: **${bet}** fichas`}\n\n` +
                `💰 Balance: **${result.newBalance}** fichas`
            )
            .setColor(result.won ? '#2ECC71' : '#E74C3C')
            .setFooter({ text: result.won ? '¡Felicidades!' : 'Mejor suerte la próxima' });

        await interaction.editReply({ content: null, embeds: [embed] });
    }
};
