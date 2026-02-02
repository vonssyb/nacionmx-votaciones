const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const LeaderboardService = require('../../services/LeaderboardService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Ver los rankings del servidor')
        .addStringOption(option =>
            option
                .setName('categoria')
                .setDescription('Categoría del ranking')
                .setRequired(false)
                .addChoices(
                    { name: '💰 Más Ricos (Dinero)', value: 'money' },
                    { name: '🎰 Casino (Ganancias)', value: 'casino' },
                    { name: '🏢 Empresas (Ingresos)', value: 'companies' },
                    { name: '⭐ Nivel (Experiencia)', value: 'level' },
                    { name: '🔥 Rachas (Días consecutivos)', value: 'streak' }
                )),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const category = interaction.options.getString('categoria') || 'money';

            let embed;
            let userPosition = null;

            switch (category) {
                case 'money':
                    embed = await this.createMoneyRanking(interaction.client);
                    userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'money');
                    break;

                case 'casino':
                    embed = await this.createCasinoRanking(interaction.client);
                    userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'casino');
                    break;

                case 'companies':
                    embed = await this.createCompaniesRanking(interaction.client);
                    break;

                case 'level':
                    embed = await this.createLevelRanking(interaction.client);
                    userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'level');
                    break;

                case 'streak':
                    embed = await this.createStreakRanking(interaction.client);
                    userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'streak');
                    break;
            }

            // Add user position if available
            if (userPosition) {
                embed.addFields({
                    name: '📍 Tu Posición',
                    value: `Estás en el puesto **#${userPosition}**`,
                    inline: false
                });
            }

            // Create dropdown menu for category selection
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ranking_category')
                        .setPlaceholder('Selecciona una categoría')
                        .addOptions([
                            {
                                label: 'Más Ricos',
                                description: 'Top usuarios por dinero total',
                                value: 'money',
                                emoji: '💰'
                            },
                            {
                                label: 'Casino',
                                description: 'Mejores jugadores de casino',
                                value: 'casino',
                                emoji: '🎰'
                            },
                            {
                                label: 'Empresas',
                                description: 'Empresas más exitosas',
                                value: 'companies',
                                emoji: '🏢'
                            },
                            {
                                label: 'Nivel',
                                description: 'Usuarios con más experiencia',
                                value: 'level',
                                emoji: '⭐'
                            },
                            {
                                label: 'Rachas',
                                description: 'Mejores rachas consecutivas',
                                value: 'streak',
                                emoji: '🔥'
                            }
                        ])
                );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Error in ranking command:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al obtener el ranking.', embeds: [], components: [] }
                : { content: '❌ Error al obtener el ranking.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    async createMoneyRanking(client) {
        const rankings = await LeaderboardService.getTopMoney(10);

        return LeaderboardService.createLeaderboardEmbed(
            '💰 Ranking de Más Ricos',
            'Top 10 usuarios con más dinero total (efectivo + banco)',
            rankings,
            (item, index) => {
                return `<@${item.user_id}> - ${LeaderboardService.formatMoney(item.total)}`;
            },
            0xFFD700
        );
    },

    async createCasinoRanking(client) {
        const rankings = await LeaderboardService.getTopCasino(10);

        return LeaderboardService.createLeaderboardEmbed(
            '🎰 Ranking de Casino',
            'Top 10 jugadores con más ganancias en el casino',
            rankings,
            (item, index) => {
                const winRate = item.total_bet > 0
                    ? ((item.total_won / item.total_bet) * 100).toFixed(1)
                    : '0.0';
                return `<@${item.user_id}> - ${LeaderboardService.formatMoney(item.total_won)} (${winRate}% ganancia)`;
            },
            0xFF1744
        );
    },

    async createCompaniesRanking(client) {
        const rankings = await LeaderboardService.getTopCompanies(10);

        return LeaderboardService.createLeaderboardEmbed(
            '🏢 Ranking de Empresas',
            'Top 10 empresas más exitosas por ingresos',
            rankings,
            (item, index) => {
                return `**${item.name}** - ${LeaderboardService.formatMoney(item.total_revenue || 0)} | ${item.employee_count || 0} empleados`;
            },
            0x2196F3
        );
    },

    async createLevelRanking(client) {
        const rankings = await LeaderboardService.getTopLevel(10);

        return LeaderboardService.createLeaderboardEmbed(
            '⭐ Ranking de Nivel',
            'Top 10 usuarios con más experiencia',
            rankings,
            (item, index) => {
                return `<@${item.user_id}> - Nivel ${item.level} (${item.total_experience.toLocaleString()} XP)`;
            },
            0x9C27B0
        );
    },

    async createStreakRanking(client) {
        const rankings = await LeaderboardService.getTopStreaks(10);

        return LeaderboardService.createLeaderboardEmbed(
            '🔥 Ranking de Rachas',
            'Top 10 rachas más largas activas',
            rankings,
            (item, index) => {
                const emoji = item.current_streak >= 30 ? '🔥🔥' : item.current_streak >= 7 ? '🔥' : '⚡';
                return `<@${item.user_id}> - ${emoji} ${item.current_streak} días (récord: ${item.longest_streak})`;
            },
            0xFF6D00
        );
    }
};
