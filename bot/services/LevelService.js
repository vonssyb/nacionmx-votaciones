const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

class LevelService {
    /**
     * Obtener información de nivel del usuario
     */
    async getUserLevel(userId) {
        try {
            const { data, error } = await supabase
                .from('user_level_info')
                .select('*')
                .eq('discord_user_id', userId)
                .single();

            if (error) {
                // User doesn't exist, create entry
                await this.createUserStats(userId);
                return await this.getUserLevel(userId);
            }

            return data;
        } catch (error) {
            logger.error('Error getting user level:', { userId, error: error.message });
            return null;
        }
    }

    /**
     * Crear entrada de stats para nuevo usuario
     */
    async createUserStats(userId) {
        try {
            const { error } = await supabase
                .from('user_stats')
                .insert({
                    discord_user_id: userId,
                    xp: 0,
                    level: 1,
                    commands_used: 0,
                    last_login: new Date().toISOString()
                });

            if (error) throw error;
            logger.info(`Created user_stats for ${userId}`);
            return true;
        } catch (error) {
            logger.error('Error creating user stats:', { userId, error: error.message });
            return false;
        }
    }

    /**
     * Obtener beneficios actuales del usuario
     */
    async getUserBenefits(userId) {
        try {
            const levelInfo = await this.getUserLevel(userId);
            if (!levelInfo) return null;

            return levelInfo.benefits || {};
        } catch (error) {
            logger.error('Error getting user benefits:', { userId, error: error.message });
            return null;
        }
    }

    /**
     * Verificar si usuario subió de nivel
     */
    async checkLevelUp(userId, oldXP, newXP) {
        try {
            // Calculate old and new levels
            const { data: oldLevelData } = await supabase
                .rpc('calculate_level_from_xp', { total_xp: oldXP });

            const { data: newLevelData } = await supabase
                .rpc('calculate_level_from_xp', { total_xp: newXP });

            const oldLevel = oldLevelData || 1;
            const newLevel = newLevelData || 1;

            if (newLevel > oldLevel) {
                logger.info(`User ${userId} leveled up: ${oldLevel} -> ${newLevel}`);
                return {
                    leveledUp: true,
                    oldLevel,
                    newLevel,
                    levelsGained: newLevel - oldLevel
                };
            }

            return { leveledUp: false };
        } catch (error) {
            logger.error('Error checking level up:', { userId, error: error.message });
            return { leveledUp: false };
        }
    }

    /**
     * Obtener top usuarios por nivel
     */
    async getTopByLevel(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('discord_user_id, level, xp')
                .order('level', { ascending: false })
                .order('xp', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Error getting top by level:', error.message);
            return [];
        }
    }

    /**
     * Obtener top usuarios por XP
     */
    async getTopByXP(limit = 10) {
        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('discord_user_id, level, xp')
                .order('xp', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Error getting top by XP:', error.message);
            return [];
        }
    }

    /**
     * Actualizar racha de inicio de sesión
     */
    async updateLoginStreak(userId) {
        try {
            const { data: stats } = await supabase
                .from('user_stats')
                .select('last_login, login_streak')
                .eq('discord_user_id', userId)
                .single();

            if (!stats) {
                await this.createUserStats(userId);
                return 1;
            }

            const now = new Date();
            const lastLogin = stats.last_login ? new Date(stats.last_login) : null;

            let newStreak = stats.login_streak || 0;

            if (lastLogin) {
                const daysSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

                if (daysSinceLastLogin === 1) {
                    // Consecutive day
                    newStreak++;
                } else if (daysSinceLastLogin > 1) {
                    // Streak broken
                    newStreak = 1;
                }
                // Same day, no change
            } else {
                newStreak = 1;
            }

            await supabase
                .from('user_stats')
                .update({
                    last_login: now.toISOString(),
                    login_streak: newStreak
                })
                .eq('discord_user_id', userId);

            return newStreak;
        } catch (error) {
            logger.error('Error updating login streak:', { userId, error: error.message });
            return 0;
        }
    }
}

module.exports = new LevelService();
