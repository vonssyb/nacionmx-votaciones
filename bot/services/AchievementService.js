const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

class AchievementService {
    /**
     * Verificar y desbloquear logros para un usuario
     */
    async checkAchievements(userId) {
        try {
            // Get user stats
            const { data: userStats } = await supabase
                .from('user_stats')
                .select('*')
                .eq('discord_user_id', userId)
                .single();

            if (!userStats) return [];

            // Get all achievements not yet unlocked by user
            const { data: unlockedIds } = await supabase
                .from('user_achievements')
                .select('achievement_id')
                .eq('user_id', userId);

            const unlockedSet = new Set((unlockedIds || []).map(u => u.achievement_id));

            const { data: allAchievements } = await supabase
                .from('achievements')
                .select('*');

            if (!allAchievements) return [];

            const newlyUnlocked = [];

            for (const achievement of allAchievements) {
                // Skip if already unlocked
                if (unlockedSet.has(achievement.id)) continue;

                // Check if requirement is met
                if (this.checkRequirement(achievement.requirement, userStats)) {
                    await this.unlockAchievement(userId, achievement);
                    newlyUnlocked.push(achievement);
                }
            }

            return newlyUnlocked;
        } catch (error) {
            logger.error('Error checking achievements:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Verificar si un requisito se cumple
     */
    checkRequirement(requirement, userStats) {
        const { condition, value } = requirement;

        switch (condition) {
            case 'commands_used_gte':
                return userStats.commands_used >= value;

            case 'total_earned_gte':
                return userStats.total_earned >= value;

            case 'total_spent_gte':
                return userStats.total_spent >= value;

            case 'total_invested_gte':
                return userStats.total_invested >= value;

            case 'total_gambled_gte':
                return userStats.total_gambled >= value;

            case 'level_gte':
                return userStats.level >= value;

            case 'login_streak_gte':
                return userStats.login_streak >= value;

            // Custom conditions can be added here
            default:
                logger.warn(`Unknown achievement condition: ${condition}`);
                return false;
        }
    }

    /**
     * Desbloquear un logro
     */
    async unlockAchievement(userId, achievement) {
        try {
            // Insert into user_achievements
            const { error: insertError } = await supabase
                .from('user_achievements')
                .insert({
                    user_id: userId,
                    achievement_id: achievement.id
                });

            if (insertError) throw insertError;

            // Give rewards
            if (achievement.rewards) {
                const rewards = achievement.rewards;

                // Give XP
                if (rewards.xp) {
                    const MissionService = require('./MissionService');
                    await MissionService.addXP(userId, rewards.xp);
                }

                // Give money
                if (rewards.money) {
                    const BillingService = require('./BillingService');
                    await BillingService.ubService.addMoney(
                        process.env.GUILD_ID,
                        userId,
                        rewards.money,
                        `🏆 Logro desbloqueado: ${achievement.name}`,
                        'cash'
                    );
                }
            }

            logger.info(`Achievement unlocked: ${achievement.name} by user ${userId}`, {
                achievement: achievement.name,
                rewards: achievement.rewards
            });

            return true;
        } catch (error) {
            logger.error('Error unlocking achievement:', {
                userId,
                achievement: achievement.name,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Obtener logros desbloqueados de un usuario
     */
    async getUserAchievements(userId) {
        try {
            const { data, error } = await supabase
                .from('user_achievements')
                .select(`
                    *,
                    achievement:achievements(*)
                `)
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Error fetching user achievements:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Obtener todos los logros con estado de unlock
     */
    async getAllAchievements(userId) {
        try {
            const { data: allAchievements } = await supabase
                .from('achievements')
                .select('*')
                .order('rarity', { ascending: true });

            const { data: unlockedAchievements } = await supabase
                .from('user_achievements')
                .select('achievement_id, unlocked_at')
                .eq('user_id', userId);

            const unlockedMap = new Map();
            (unlockedAchievements || []).forEach(ua => {
                unlockedMap.set(ua.achievement_id, ua.unlocked_at);
            });

            return (allAchievements || []).map(achievement => ({
                ...achievement,
                unlocked: unlockedMap.has(achievement.id),
                unlocked_at: unlockedMap.get(achievement.id) || null
            }));
        } catch (error) {
            logger.error('Error fetching all achievements:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Obtener estadísticas de logros del usuario
     */
    async getAchievementStats(userId) {
        try {
            const allAchievements = await this.getAllAchievements(userId);
            const unlocked = allAchievements.filter(a => a.unlocked);

            const byRarity = {
                common: { unlocked: 0, total: 0 },
                rare: { unlocked: 0, total: 0 },
                epic: { unlocked: 0, total: 0 },
                legendary: { unlocked: 0, total: 0 }
            };

            allAchievements.forEach(achievement => {
                const rarity = achievement.rarity || 'common';
                byRarity[rarity].total++;
                if (achievement.unlocked) {
                    byRarity[rarity].unlocked++;
                }
            });

            const totalPoints = unlocked.reduce((sum, a) => sum + (a.points || 0), 0);
            const maxPoints = allAchievements.reduce((sum, a) => sum + (a.points || 0), 0);

            return {
                total: allAchievements.length,
                unlocked: unlocked.length,
                percentage: Math.round((unlocked.length / allAchievements.length) * 100),
                byRarity,
                points: totalPoints,
                maxPoints,
                pointsPercentage: Math.round((totalPoints / maxPoints) * 100)
            };
        } catch (error) {
            logger.error('Error getting achievement stats:', { userId, error: error.message });
            return null;
        }
    }
}

module.exports = new AchievementService();
