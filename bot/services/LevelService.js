const logger = require('./Logger');

class LevelService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // XP Formula matching SQL function: 100 * level^2 + 50 * level
    getXPRequiredForLevel(level) {
        if (level < 1) return 0;
        return 100 * Math.pow(level, 2) + 50 * level;
    }

    calculateLevelFromXP(totalXP) {
        let level = 1;
        while (true) {
            const required = this.getXPRequiredForLevel(level);
            if (totalXP < required) return level;
            level++;
            if (level > 1000) return 1000; // Cap
        }
    }

    async addXP(userId, amount) {
        try {
            // Get current stats
            const { data: stats, error } = await this.supabase
                .from('user_stats')
                .select('*')
                .eq('discord_user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                logger.error('Error fetching user stats:', error);
                return null;
            }

            let currentXP = 0;
            let currentLevel = 1;

            if (!stats) {
                // Initialize user
                await this.supabase.from('user_stats').insert({
                    discord_user_id: userId,
                    xp: amount,
                    level: 1
                });
                currentXP = amount;
            } else {
                currentXP = stats.xp + amount;
                currentLevel = stats.level;

                const { error: updateError } = await this.supabase
                    .from('user_stats')
                    .update({ xp: currentXP }) // Trigger handles level up? Yes, if trigger exists.
                    .eq('discord_user_id', userId);

                if (updateError) throw updateError;
            }

            // Check new level locally to notify users immediately (Trigger is async/hidden)
            // Or fetch again?
            // Let's calculate locally.
            const newLevel = this.calculateLevelFromXP(currentXP);

            if (newLevel > currentLevel) {
                logger.info(`User ${userId} leveled up to ${newLevel}!`);
                return { leveledUp: true, newLevel, amountAdded: amount };
            }

            return { leveledUp: false, newLevel, amountAdded: amount };

        } catch (error) {
            logger.error('Error adding XP:', error);
            return null;
        }
    }

    async getUserStats(userId) {
        const { data, error } = await this.supabase
            .from('user_stats')
            .select('*')
            .eq('discord_user_id', userId)
            .single();

        if (error) return null;

        const nextLevelXP = this.getXPRequiredForLevel(data.level);
        const prevLevelXP = this.getXPRequiredForLevel(data.level - 1);

        // XP progress for bar: (current - prev) / (next - prev)
        const currentLevelProgress = data.xp - prevLevelXP;
        const levelRange = nextLevelXP - prevLevelXP;

        return {
            ...data,
            nextLevelXP,
            progressPercent: Math.min(100, Math.floor((currentLevelProgress / levelRange) * 100))
        };
    }
}

module.exports = LevelService;
