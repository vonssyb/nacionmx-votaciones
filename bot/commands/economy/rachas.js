const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const StreakService = require('../../services/StreakService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rachas')
        .setDescription('Ver tu racha de días consecutivos'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const streak = await StreakService.getStreak(userId);

            if (!streak || streak.current_streak === 0) {
                return interaction.editReply({
                    content: '⚡ Aún no tienes una racha. ¡Usa `/fichar` para comenzar!',
                    ephemeral: true
                });
            }

            // Get next milestone
            const nextMilestone = StreakService.getNextMilestone(streak.current_streak);

            // Create progress bar for next milestone
            let progressBar = '';
            if (nextMilestone) {
                const progress = streak.current_streak / nextMilestone.days;
                const filled = Math.floor(progress * 10);
                progressBar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
            }

            const embed = new EmbedBuilder()
                .setColor(streak.current_streak >= 30 ? 0xFF6D00 : streak.current_streak >= 7 ? 0xFFD700 : 0x4CAF50)
                .setTitle(`${StreakService.getStreakEmoji(streak.current_streak)} Racha de ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: '🔥 Racha Actual',
                        value: `**${streak.current_streak}** días consecutivos`,
                        inline: true
                    },
                    {
                        name: '🏆 Récord Personal',
                        value: `**${streak.longest_streak}** días`,
                        inline: true
                    },
                    {
                        name: '📊 Total de Claims',
                        value: `${streak.total_claims} veces`,
                        inline: true
                    }
                );

            // Add next milestone if exists
            if (nextMilestone) {
                embed.addFields({
                    name: '🎯 Próxima Meta',
                    value: `**${nextMilestone.days} días** - ${LeaderboardService.formatMoney(nextMilestone.reward)}\n${progressBar} ${streak.current_streak}/${nextMilestone.days}\nFaltan **${nextMilestone.daysLeft}** días`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '👑 ¡Nivel Máximo!',
                    value: 'Has alcanzado todas las metas. ¡Sigue así!',
                    inline: false
                });
            }

            // Add badge if applicable
            const badge = StreakService.getStreakBadge(streak);
            if (badge) {
                embed.addFields({
                    name: '🎖️ Insignia',
                    value: badge,
                    inline: false
                });
            }

            // Get top 5 streaks
            const topStreaks = await StreakService.getTopStreaks(5);
            const myPosition = topStreaks.findIndex(s => s.user_id === userId);

            if (myPosition >= 0) {
                embed.addFields({
                    name: '📍 Tu Posición',
                    value: `Top **#${myPosition + 1}** del servidor`,
                    inline: false
                });
            }

            embed.setTimestamp();
            embed.setFooter({ text: '¡Mantén tu racha activa con /fichar!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in rachas command:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al obtener la racha.', embeds: [] }
                : { content: '❌ Error al obtener la racha.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

// Import LeaderboardService for formatting
const LeaderboardService = require('../../services/LeaderboardService');
