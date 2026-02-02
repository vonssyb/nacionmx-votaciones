const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DailyRewardService = require('../../services/DailyRewardService');
const { supabase } = require('../../config/supabaseClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diario')
        .setDescription('Reclama tu recompensa diaria'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;

            // Claim daily reward
            const result = await DailyRewardService.claimDailyReward(userId);

            if (!result.success) {
                if (result.alreadyClaimed) {
                    const nextClaimTime = `<t:${result.nextClaimTimestamp}:R>`;
                    return interaction.editReply({
                        content: `⏰ Ya reclamaste tu recompensa diaria hoy.\n\n🎁 Próxima recompensa disponible: ${nextClaimTime}`,
                        ephemeral: true
                    });
                }
                return interaction.editReply({
                    content: '❌ Error al reclamar la recompensa diaria.',
                    ephemeral: true
                });
            }

            // Add money to user's balance
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    balance: supabase.rpc('increment_balance', {
                        amount: result.totalReward
                    })
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating balance:', updateError);
            }

            // Create reward reveal embed
            const embed = new EmbedBuilder()
                .setColor(result.isLucky ? 0xFFD700 : 0x4CAF50)
                .setTitle(result.isLucky ? '🎊 ¡PREMIO ESPECIAL!' : '🎁 Recompensa Diaria')
                .setDescription(`¡Has reclamado tu recompensa del día **${result.consecutiveDays}**!`)
                .addFields(
                    {
                        name: '💵 Recompensa Base',
                        value: `${this.formatMoney(result.baseReward)}`,
                        inline: true
                    }
                );

            if (result.luckyBonus > 0) {
                embed.addFields({
                    name: '✨ ¡Bonus de Suerte!',
                    value: `+${this.formatMoney(result.luckyBonus)}`,
                    inline: true
                });
            }

            embed.addFields({
                name: '💰 Total Recibido',
                value: `**${this.formatMoney(result.totalReward)}**`,
                inline: true
            });

            // Add streak info
            const streakEmoji = result.consecutiveDays >= 30 ? '🔥🔥' : result.consecutiveDays >= 7 ? '🔥' : '⚡';
            embed.addFields({
                name: `${streakEmoji} Racha Consecutiva`,
                value: `${result.consecutiveDays} días seguidos`,
                inline: true
            });

            if (result.bestStreak > result.consecutiveDays) {
                embed.addFields({
                    name: '🏆 Tu Récord',
                    value: `${result.bestStreak} días`,
                    inline: true
                });
            }

            // Add milestone notification
            if (result.isMilestone) {
                embed.addFields({
                    name: '🎯 ¡Meta Alcanzada!',
                    value: `Has completado ${result.consecutiveDays} días consecutivos. ¡Sigue así!`,
                    inline: false
                });
            }

            // Add next milestone info
            if (result.nextMilestone) {
                const progress = result.consecutiveDays / result.nextMilestone.days;
                const filled = Math.floor(progress * 10);
                const progressBar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

                embed.addFields({
                    name: '🎯 Próxima Meta',
                    value: `**Día ${result.nextMilestone.days}** - ${this.formatMoney(result.nextMilestone.reward)}\n${progressBar} ${result.consecutiveDays}/${result.nextMilestone.days}\nFaltan **${result.nextMilestone.daysLeft}** días`,
                    inline: false
                });
            }

            embed.setThumbnail(interaction.user.displayAvatarURL());
            embed.setTimestamp();
            embed.setFooter({ text: '¡Regresa mañana para mantener tu racha!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in diario command:', error);
            const errorMessage = interaction.deferred
                ? { content: '❌ Error al reclamar la recompensa diaria.', embeds: [] }
                : { content: '❌ Error al reclamar la recompensa diaria.', ephemeral: true };

            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },

    formatMoney(amount) {
        return `$${amount.toLocaleString('en-US')}`;
    }
};
