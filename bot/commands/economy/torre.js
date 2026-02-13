const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('torre')
        .setDescription('🗼 Escala la torre para ganar multiplicadores')
        .addIntegerOption(option =>
            option.setName('apuesta')
                .setDescription('Cantidad de fichas')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(5000))
        .addStringOption(option =>
            option.setName('dificultad')
                .setDescription('Nivel de riesgo')
                .setRequired(true)
                .addChoices(
                    { name: '🟢 Fácil (3 Safe / 4 Cols)', value: 'easy' },
                    { name: '🟡 Medio (2 Safe / 3 Cols)', value: 'medium' },
                    { name: '🔴 Difícil (1 Safe / 3 Cols)', value: 'hard' }
                )),

    async execute(interaction, client, supabase) {
        const userId = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const diff = interaction.options.getString('dificultad');

        let casino = client.casinoService;
        if (!casino) casino = new CasinoService(supabase);

        if (casino.sessions.tower[userId]) return interaction.reply({ content: '❌ Ya estás escalando una torre.', ephemeral: true });

        // Atomic Start
        await interaction.deferReply();
        const result = await casino.startTowerAndUpdate(interaction, bet, diff);

        if (!result.success) {
            return interaction.editReply({ content: result.error || '❌ Error al iniciar la torre.' });
        }
    }
};
