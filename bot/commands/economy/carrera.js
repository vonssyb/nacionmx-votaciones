const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carrera')
        .setDescription('🏇 Apostar en carreras de caballos')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas a apostar')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000))
        .addIntegerOption(option =>
            option.setName('caballo')
                .setDescription('Caballo a elegir (1-4)')
                .setRequired(true)
                .addChoices(
                    { name: '1. 🐴 Relámpago', value: 1 },
                    { name: '2. 🏇 Trueno', value: 2 },
                    { name: '3. 🐎 Viento', value: 3 },
                    { name: '4. 🦄 Estrella', value: 4 }
                )),

    async execute(interaction, client, supabase) {
        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const horseId = interaction.options.getInteger('caballo');

        // Check chips
        const check = await casino.checkChips(userId, bet);
        if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

        // Deduct bet
        await supabase.from('casino_chips').update({ chips_balance: check.balance - bet }).eq('discord_user_id', userId);

        // Start or join session
        const isNewSession = casino.startRaceSession(interaction);

        // Add bet
        casino.sessions.race.bets.push({
            userId,
            amount: bet,
            horseId,
            interaction
        });

        if (isNewSession) {
            await interaction.reply(`🏇 **CARRERA INICIADA**\n\nApuestas abiertas por 45s...\n¡Elige tu caballo ganador!`);
        } else {
            const horseName = casino.sessions.race.horses.find(h => h.id === horseId).name;
            await interaction.reply({ content: `✅ Apostaste **${bet}** fichas a **${horseName}**`, ephemeral: true });
        }
    }
};
