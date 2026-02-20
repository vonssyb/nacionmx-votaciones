const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ruleta')
        .setDescription('🎡 Jugar a la ruleta europea (Casino)')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(10000))
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de apuesta')
                .setRequired(true)
                .addChoices(
                    { name: 'Número Exacto (35:1)', value: 'numero' },
                    { name: 'Rojo (1:1)', value: 'red' },
                    { name: 'Negro (1:1)', value: 'black' },
                    { name: 'Par (1:1)', value: 'even' },
                    { name: 'Impar (1:1)', value: 'odd' },
                    { name: '1-18 (1:1)', value: '1-18' },
                    { name: '19-36 (1:1)', value: '19-36' },
                    { name: '1ª Columna (2:1)', value: 'col1' },
                    { name: '2ª Columna (2:1)', value: 'col2' },
                    { name: '3ª Columna (2:1)', value: 'col3' }
                ))
        .addIntegerOption(option =>
            option.setName('numero')
                .setDescription('Número específico (0-36) si elegiste apuesta exacta')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(36)),

    async execute(interaction, client, supabase) {
        await interaction.deferReply(); // FIXED: Reduce timeout risk
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('apuesta');
        const betType = interaction.options.getString('tipo');
        const number = interaction.options.getInteger('numero');

        if (betType === 'numero' && number === null) {
            return interaction.editReply({ content: '❌ Debes especificar un número para la apuesta exacta.', ephemeral: true });
        }

        // Initialize service
        // Since CasinoService has state (sessions), we should use a Singleton attached to client if possible, 
        // OR rely on the fact that sessions are in-memory. If we new() it every time, sessions are lost.
        // CHECK: Where is the persistent CasinoService instance? 
        // Usually, client.services.casino or similar.
        // I will assume client.services.casino exists or I should attach it in bot entry point.
        // For now, if I create new instance, roulette session logic won't work properly across different commands/interactions if they split.
        // BUT here, everything happens in one execution flow usually or via timeout in the same process. 
        // However, `startRouletteSession` sets a timeout on `this`. If I lose `this`, I lose the timeout context? No, timeout handles keeping refs.
        // PROBLEM: Multiple users betting on the SAME roulette session requires a shared instance.
        // User requested multiplayer. The CasinoService code has `this.sessions.roulette`. 
        // If I do `const casino = new CasinoService(supabase)`, it's a new instance.
        // I NEED A SHARED INSTANCE.

        // Initialize service
        let casino = client.casinoService;
        if (!casino) {
            casino = new CasinoService(supabase);
            client.casinoService = casino;
        }

        // Atomic Transaction (Result determined upfront)
        const result = await casino.playRouletteAndUpdate(userId, betAmount, betType, number);

        if (!result.success) {
            return interaction.editReply({ content: result.error || '❌ Error al jugar ruleta.', ephemeral: true });
        }

        // TENSION FLOW (30s Animation)
        const embedInitial = new EmbedBuilder()
            .setTitle('🎡 RULETA: GIRANDO')
            .setDescription('La ruleta ha comenzado a girar... 🎲\n\n> ⏳ **Tiempo restante:** 30s')
            .setColor('#E74C3C')
            .addFields({ name: 'Tu Apuesta', value: `${betAmount} fichas a ${betType.toUpperCase()}` });

        await interaction.editReply({ embeds: [embedInitial] });

        // Phase 1: 10s
        setTimeout(async () => {
            const embed10 = new EmbedBuilder()
                .setTitle('🎡 RULETA: GIRANDO')
                .setDescription('La bola está perdiendo velocidad... 🎢\n\n> ⏳ **Tiempo restante:** 20s')
                .setColor('#E67E22')
                .addFields({ name: 'Tu Apuesta', value: `${betAmount} fichas a ${betType.toUpperCase()}` });

            await interaction.editReply({ embeds: [embed10] }).catch(() => { });
        }, 10000);

        // Phase 2: 20s
        setTimeout(async () => {
            const embed20 = new EmbedBuilder()
                .setTitle('🎡 RULETA: TENSION')
                .setDescription('¡La bola está saltando entre los números! 🎱\n\n> ⏳ **Tiempo restante:** 10s')
                .setColor('#F1C40F')
                .addFields({ name: 'Tu Apuesta', value: `${betAmount} fichas a ${betType.toUpperCase()}` });

            await interaction.editReply({ embeds: [embed20] }).catch(() => { });
        }, 20000);

        // Phase 3: 30s (Result)
        setTimeout(async () => {
            const colorEmoji = result.color === 'red' ? '🔴' : (result.color === 'black' ? '⚫' : '🟢');

            const embedResult = new EmbedBuilder()
                .setTitle(`🎡 Resultado: ${result.resultNumber} ${colorEmoji}`)
                .setDescription(result.won
                    ? `🎉 **¡GANASTE!** 🎉\nRecibes **${result.payout}** fichas.`
                    : `❌ **Perdiste...**\nLa bola cayó en ${result.resultNumber} (${result.color}).`)
                .setColor(result.won ? '#2ECC71' : '#E74C3C')
                .addFields(
                    { name: 'Apuesta', value: `${betAmount}`, inline: true },
                    { name: 'Resultado', value: `${result.resultNumber} ${colorEmoji.toUpperCase()}`, inline: true }
                );

            await interaction.editReply({ embeds: [embedResult] }).catch(() => { });
        }, 30000);
    }
};
