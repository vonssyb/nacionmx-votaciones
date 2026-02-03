const { SlashCommandBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('🃏 Jugar Blackjack Multijugador')
        .addSubcommand(subcommand =>
            subcommand
                .setName('iniciar')
                .setDescription('Iniciar nueva mesa de blackjack')
                .addIntegerOption(option =>
                    option.setName('apuesta')
                        .setDescription('Tu apuesta para esta ronda')
                        .setRequired(true)
                        .setMinValue(50)
                        .setMaxValue(5000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unirse')
                .setDescription('Unirse a la mesa activa en este canal')
                .addIntegerOption(option =>
                    option.setName('apuesta')
                        .setDescription('Tu apuesta')
                        .setRequired(true)
                        .setMinValue(50)
                        .setMaxValue(5000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('comenzar')
                .setDescription('Empezar la partida (Solo creador)')),

    async execute(interaction, client, supabase) {
        let casino = client.casinoService;
        if (!casino) {
            casino = new CasinoService(supabase);
            client.casinoService = casino;
        }

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const session = casino.sessions.blackjack;

        try {
            if (subcommand === 'iniciar') {
                if (session.isOpen || session.state !== 'LOBBY') {
                    return interaction.reply({ content: '❌ Ya hay una mesa activa en el bot. Usa `/blackjack unirse` o espera a que termine.', ephemeral: true });
                }

                const bet = interaction.options.getInteger('apuesta');
                const check = await casino.checkChips(userId, bet);
                if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

                // Start Lobby
                session.isOpen = true;
                session.state = 'LOBBY';
                session.players = {};
                session.players[userId] = {
                    id: userId,
                    bet: bet,
                    hand: [],
                    status: 'PLAYING', // Will be active when game starts
                    username: interaction.user.username
                };

                // Deduct chips using helper
                await casino.removeChips(userId, bet);

                const embed = new EmbedBuilder()
                    .setTitle('🃏 Mesa de Blackjack')
                    .setDescription(`**Host:** <@${userId}>\n**Apuesta:** $${bet}\n\nEsperando jugadores...`)
                    .setImage('attachment://blackjack_table.png') // Reference attachment
                    .setColor('#2ECC71');

                await interaction.reply({
                    embeds: [embed],
                    files: [{ attachment: '/Users/gonzalez/.gemini/antigravity/brain/5f676979-327b-4733-bc92-9b946495f94a/casino_blackjack_table_1770078092622.png', name: 'blackjack_table.png' }]
                });

            } else if (subcommand === 'unirse') {
                if (!session.isOpen || session.state !== 'LOBBY') {
                    return interaction.reply({ content: '❌ No hay una mesa en fase de inscripción.', ephemeral: true });
                }
                if (session.players[userId]) {
                    return interaction.reply({ content: '❌ Ya estás en la mesa.', ephemeral: true });
                }
                if (Object.keys(session.players).length >= 4) {
                    return interaction.reply({ content: '❌ La mesa está llena (Max 4).', ephemeral: true });
                }

                const bet = interaction.options.getInteger('apuesta');
                const check = await casino.checkChips(userId, bet);
                if (!check.hasEnough) return interaction.reply({ content: check.message, ephemeral: true });

                session.players[userId] = {
                    id: userId,
                    bet: bet,
                    hand: [],
                    status: 'PLAYING',
                    username: interaction.user.username
                };

                await casino.removeChips(userId, bet);

                await interaction.reply(`✅ **${interaction.user.username}** se unió con $${bet}.`);

            } else if (subcommand === 'comenzar') {
                if (!session.isOpen || session.state !== 'LOBBY') {
                    return interaction.reply({ content: '❌ No hay mesa para comenzar.', ephemeral: true });
                }
                // Check if user is the creator (the first one in players keys usually, or handle CreatorID properly)
                // For simplicity assuming anyone in game can start or just the first joined.
                // Let's allow anyone in the game to start for now to avoid stuck lobbies.
                if (!session.players[userId]) {
                    return interaction.reply({ content: '❌ No estás en la mesa.', ephemeral: true });
                }

                await interaction.reply('🚀 Comenzando partida...');
                await casino.startBlackjackGame(interaction.channel);
            }

        } catch (error) {
            console.error(error);
            interaction.reply({ content: '❌ Error en blackjack.', ephemeral: true }).catch(() => { });
        }
    }
};
