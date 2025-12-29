class AchievementService {
    constructor(supabaseClient, levelService) {
        this.supabase = supabaseClient;
        this.levelService = levelService;
    }

    async checkAndUnlock(userId, conditionType, value) {
        // checks conditions against all locked achievements
        // conditionType: 'total_earned_gte', 'level_gte', etc.
        try {
            // 1. Get unlocked achievements IDs
            const { data: unlocked } = await this.supabase
                .from('user_achievements')
                .select('achievement_id')
                .eq('user_id', userId);

            const unlockedIds = unlocked?.map(u => u.achievement_id) || [];

            // 2. Get candidates
            const { data: candidates } = await this.supabase
                .from('achievements')
                .select('*')
                .not('id', 'in', `(${unlockedIds.join(',')})`) // This syntax might fail if empty list
                // Better to fetch ALL relevant category? Or check locally.
                // Or just fetch all non-unlocked?
                ;

            // Fix empty array query issue
            let query = this.supabase.from('achievements').select('*');
            if (unlockedIds.length > 0) {
                query = query.not('id', 'in', `(${unlockedIds.join(',')})`);
            }

            const { data: potentialAchievements } = await query;
            if (!potentialAchievements) return [];

            const newlyUnlocked = [];

            for (const ach of potentialAchievements) {
                const req = ach.requirement; // {"condition": "...", "value": ...}
                if (!req) continue;

                if (req.condition === conditionType) {
                    if (value >= req.value) {
                        // UNLOCK!
                        await this.unlock(userId, ach);
                        newlyUnlocked.push(ach);
                    }
                }
            }

            return newlyUnlocked;

        } catch (error) {
            logger.error('Error checking achievements:', error);
            return [];
        }
    }

    async unlock(userId, achievement) {
        try {
            await this.supabase.from('user_achievements').insert({
                user_id: userId,
                achievement_id: achievement.id
            });

            logger.info(`Achievement Unlocked: ${achievement.name} for ${userId}`);

            // Apply Rewards
            if (achievement.rewards) {
                if (achievement.rewards.xp && this.levelService) {
                    await this.levelService.addXP(userId, achievement.rewards.xp);
                }

                if (achievement.rewards.money) {
                    // Assuming BillingService via global or require... 
                    // Circular dependency risk if not careful.
                    // Prefer passing client or using require inside function.
                    // But easier to verify later manually.
                }
            }
        } catch (error) {
            logger.error('Error unlocking achievement:', error);
        }
    }
}

module.exports = AchievementService;
