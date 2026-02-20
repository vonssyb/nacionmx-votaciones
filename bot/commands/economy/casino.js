const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const CasinoService = require('../../services/CasinoService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('🎰 Menú principal y juegos del Casino NacionMX')
        // BLACKJACK GROUP
        .addSubcommandGroup(group =>
            group.setName('blackjack')
                .setDescription('🃏 Jugar Blackjack Multijugador')
                .addSubcommand(sub =>
                    sub.setName('iniciar')
                        .setDescription('Iniciar nueva mesa de blackjack')
                        .addIntegerOption(opt => opt.setName('apuesta').setDescription('Fichas a apostar').setRequired(true).setMinValue(50).setMaxValue(5000)))
                .addSubcommand(sub =>
                    sub.setName('unirse')
                        .setDescription('Unirse a la mesa activa')
                        .addIntegerOption(opt => opt.setName('apuesta').setDescription('Fichas a apostar').setRequired(true).setMinValue(50).setMaxValue(5000)))
                .addSubcommand(sub =>
                    sub.setName('comenzar')
                        .setDescription('Empezar la partida (Solo creador)'))
        )
        // RULETA
        .addSubcommand(sub =>
            sub.setName('ruleta')
                .setDescription('🎡 Jugar Ruleta Europea')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(10000))
                .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de apuesta').setRequired(true)
                    .addChoices(
                        { name: 'Número Exacto (35:1)', value: 'numero' },
                        { name: 'Rojo (1:1)', value: 'red' }, { name: 'Negro (1:1)', value: 'black' },
                        { name: 'Par (1:1)', value: 'even' }, { name: 'Impar (1:1)', value: 'odd' },
                        { name: '1-18 (1:1)', value: '1-18' }, { name: '19-36 (1:1)', value: '19-36' },
                        { name: '1ª Columna (2:1)', value: 'col1' }, { name: '2ª Columna (2:1)', value: 'col2' }, { name: '3ª Columna (2:1)', value: 'col3' }
                    ))
                .addIntegerOption(opt => opt.setName('numero').setDescription('Número específico (0-36)').setRequired(false).setMinValue(0).setMaxValue(36))
        )
        // DADOS
        .addSubcommand(sub =>
            sub.setName('dados')
                .setDescription('🎲 Lanza los dados')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(5000))
                .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de apuesta').setRequired(true)
                    .addChoices(
                        { name: '🎲 7 Exacto (x4)', value: '7' },
                        { name: '🔼 Mayor a 7 (x2)', value: 'over_7' }, { name: '🔽 Menor a 7 (x2)', value: 'under_7' },
                        { name: '🔢 Par (x2)', value: 'even' }, { name: '🔣 Impar (x2)', value: 'odd' },
                        { name: '👯 Dobles (x5)', value: 'doubles' }
                    ))
        )
        // TRAGAMONEDAS
        .addSubcommand(sub =>
            sub.setName('tragamonedas')
                .setDescription('🎰 Slots Machine')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(5000))
        )
        // RASPA
        .addSubcommand(sub =>
            sub.setName('raspa')
                .setDescription('🎫 Raspa y Gana')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(2000))
        )
        // COINFLIP
        .addSubcommand(sub =>
            sub.setName('coinflip')
                .setDescription('🪙 Duelo Cara o Cruz')
                .addUserOption(opt => opt.setName('oponente').setDescription('Usuario a desafiar').setRequired(true))
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(50).setMaxValue(10000))
        )
        // CRASH
        .addSubcommand(sub =>
            sub.setName('crash')
                .setDescription('🚀 Cohete Multiplicador')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(50000))
                .addNumberOption(opt => opt.setName('auto_retiro').setDescription('Retiro automático (ej 2.0)').setRequired(false).setMinValue(1.01).setMaxValue(100.00))
        )
        // TORRE
        .addSubcommand(sub =>
            sub.setName('torre')
                .setDescription('🗼 Escala la Torre')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(5000))
                .addStringOption(opt => opt.setName('dificultad').setDescription('Riesgo').setRequired(true)
                    .addChoices(
                        { name: '🟢 Fácil', value: 'easy' }, { name: '🟡 Medio', value: 'medium' }, { name: '🔴 Difícil', value: 'hard' }
                    ))
        )
        // MINAS
        .addSubcommand(sub =>
            sub.setName('minas')
                .setDescription('💣 Campo Minado')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(5000))
                .addIntegerOption(opt => opt.setName('cantidad_minas').setDescription('Número de minas (1-19)').setRequired(true).setMinValue(1).setMaxValue(19))
        )
        // CARRERA
        .addSubcommand(sub =>
            sub.setName('carrera')
                .setDescription('🏇 Carreras de Caballos')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(5000))
                .addIntegerOption(opt => opt.setName('caballo').setDescription('Elige tu caballo (1-4)').setRequired(true)
                    .addChoices({ name: '1. 🐴 Relámpago', value: 1 }, { name: '2. 🏇 Trueno', value: 2 }, { name: '3. 🐎 Viento', value: 3 }, { name: '4. 🦄 Estrella', value: 4 }))
        )
        // VIDEOPOKER
        .addSubcommand(sub =>
            sub.setName('videopoker')
                .setDescription('🃏 Poker Jacks or Better')
                .addIntegerOption(opt => opt.setName('apuesta').setDescription('Cantidad de fichas').setRequired(true).setMinValue(10).setMaxValue(50000))
        )
        // AYUDA (Legacy Default)
        .addSubcommand(sub =>
            sub.setName('ayuda')
                .setDescription('📖 Ver lista de juegos y pagos')
        ),

    async execute(interaction, client, supabase) {
        // Init Global Casino Service
        if (!client.casinoService) {
            client.casinoService = new CasinoService(supabase);
        }

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (group === 'blackjack') {
                return require('../../utils/casino_games/blackjack').execute(interaction, client, supabase);
            }

            switch (subcommand) {
                case 'ruleta': return require('../../utils/casino_games/ruleta').execute(interaction, client, supabase);
                case 'dados': return require('../../utils/casino_games/dados').execute(interaction, client, supabase);
                case 'tragamonedas': return require('../../utils/casino_games/tragamonedas').execute(interaction, client, supabase);
                case 'raspa': return require('../../utils/casino_games/raspa').execute(interaction, client, supabase);
                case 'coinflip': return require('../../utils/casino_games/coinflip').execute(interaction, client, supabase);
                case 'crash': return require('../../utils/casino_games/crash').execute(interaction, client, supabase);
                case 'torre': return require('../../utils/casino_games/torre').execute(interaction, client, supabase);
                case 'minas': return require('../../utils/casino_games/minas').execute(interaction, client, supabase);
                case 'carrera': return require('../../utils/casino_games/carrera').execute(interaction, client, supabase);
                case 'videopoker': return require('../../utils/casino_games/videopoker').execute(interaction, client, supabase);
                case 'ayuda':
                default:
                    // Default Help Embed
                    const embed = new EmbedBuilder()
                        .setTitle('🎰 CASINO NACIONMX')
                        .setDescription('Usa `/casino [juego]` para empezar.')
                        .setColor('#F1C40F')
                        .addFields(
                            { name: '🎲 Juegos Mesa', value: '`blackjack`, `ruleta`, `carrera`, `coinflip`' },
                            { name: '🚀 Solo', value: '`minas`, `torre`, `crash`, `videopoker`' },
                            { name: '⚡ Rápido', value: '`dados`, `tragamonedas`, `raspa`' }
                        );
                    return interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (error) {
            console.error(error);
            const msg = '❌ Error ejecutando el juego.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg });
            else await interaction.reply({ content: msg, ephemeral: true });
        }
    }
};
