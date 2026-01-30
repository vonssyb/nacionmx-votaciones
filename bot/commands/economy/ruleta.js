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
        const userId = interaction.user.id;
        const betAmount = interaction.options.getInteger('apuesta');
        const betType = interaction.options.getString('tipo');
        const number = interaction.options.getInteger('numero');

        if (betType === 'numero' && number === null) {
            return interaction.reply({ content: '❌ Debes especificar un número para la apuesta exacta.', ephemeral: true });
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

        let casino = client.casinoService;
        if (!casino) {
            // Lazy init if not on client (though it should be added to index.js)
            casino = new CasinoService(supabase);
            client.casinoService = casino;
        }

        // Check chips
        const check = await casino.checkChips(userId, betAmount);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Deduct chips immediately
        await supabase.from('casino_chips')
            .update({ chips_balance: check.balance - betAmount })
            .eq('discord_user_id', userId);

        // Start or Join Session
        const isNewSession = casino.startRouletteSession(interaction);

        // Add bet to session
        casino.sessions.roulette.bets.push({
            userId,
            amount: betAmount,
            betType,
            numero: number,
            interaction, // We store interaction to edit reply later
            currentChips: check.balance - betAmount // Store state for restore
        });

        if (isNewSession) {
            await interaction.reply(`🎡 **RULETA INICIADA**\n\nRespondiendo a apuestas durante 30s...\n¡Hagan sus apuestas!`);
        } else {
            await interaction.reply({ content: `✅ Apuesta registrada: **${betAmount}** fichas a **${betType.toUpperCase()}**`, ephemeral: true });

            // Notify channel if possible
            if (interaction.channel) {
                // interaction.channel.send(`${interaction.user.username} apostó ${betAmount} fichas.`);
            }
        }
    }
};
