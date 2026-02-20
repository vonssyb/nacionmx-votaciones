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
        if (!casino) {
            casino = new CasinoService(supabase);
            client.casinoService = casino;
        }

        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const horseId = interaction.options.getInteger('caballo');

        // Atomic Join & Bet
        const result = await casino.joinRaceAndUpdate(interaction, bet, horseId);

        if (!result.success) {
            return interaction.reply({ content: result.error || '❌ Error al unirse a la carrera.', ephemeral: true });
        }

        if (result.isNew) {
            await interaction.reply(`🏇 **CARRERA INICIADA**\n\nApuestas abiertas por 45s...\n¡Elige tu caballo ganador!`);
        } else {
            await interaction.reply({ content: `✅ Apostaste **${bet}** fichas a **${result.horseName}**`, ephemeral: true });
        }
    }
};
