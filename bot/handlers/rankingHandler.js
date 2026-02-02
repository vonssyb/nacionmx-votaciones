const LeaderboardService = require('../../services/LeaderboardService');

/**
 * Handler for ranking category dropdown selection
 */
async function handleRankingCategorySelect(interaction) {
    try {
        await interaction.deferUpdate();

        const category = interaction.values[0];
        let embed;
        let userPosition = null;

        // Get ranking embed based on selection
        const rankingCommand = require('../../commands/utils/ranking');

        switch (category) {
            case 'money':
                embed = await rankingCommand.createMoneyRanking(interaction.client);
                userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'money');
                break;

            case 'casino':
                embed = await rankingCommand.createCasinoRanking(interaction.client);
                userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'casino');
                break;

            case 'companies':
                embed = await rankingCommand.createCompaniesRanking(interaction.client);
                break;

            case 'level':
                embed = await rankingCommand.createLevelRanking(interaction.client);
                userPosition = await LeaderboardService.getUserPosition(interaction.user.id, 'level');
                break;

            case 'streak':
                embed = await rankingCommand.createStreakRanking(interaction.client);
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

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error handling ranking category selection:', error);
        await interaction.editReply({
            content: '❌ Error al actualizar el ranking.',
            embeds: [],
            components: []
        });
    }
}

module.exports = { handleRankingCategorySelect };
