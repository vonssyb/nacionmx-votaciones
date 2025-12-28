const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

class MissionService {
    /**
     * Inicializar misiones diarias para un usuario
     */
    async initializeDailyMissions(userId) {
        try {
            logger.info(`Initializing daily missions for user ${userId}`);

            // Get 3 random daily missions
            const { data: missions, error: fetchError } = await supabase
                .from('missions')
                .select('*')
                .eq('type', 'daily')
                .eq('is_active', true)
                .limit(10);

            if (fetchError) throw fetchError;
            if (!missions || missions.length === 0) {
                logger.warn('No daily missions available');
                return [];
            }

            // Shuffle and take 3
            const shuffled = missions.sort(() => 0.5 - Math.random());
            const selectedMissions = shuffled.slice(0, 3);

            // Create user_missions entries
            const userMissions = selectedMissions.map(mission => ({
                user_id: userId,
                mission_id: mission.id,
                progress: { current: 0, required: mission.requirement.count || 1 },
                status: 'active',
                expires_at: this.getEndOfDay()
            }));

            const { data, error } = await supabase
                .from('user_missions')
                .insert(userMissions)
                .select();

            if (error) throw error;

            logger.info(`Initialized ${data.length} daily missions for user ${userId}`);
            return data;
        } catch (error) {
            logger.error('Error initializing daily missions:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Inicializar misiones semanales para un usuario
     */
    async initializeWeeklyMissions(userId) {
        try {
            const { data: missions, error: fetchError } = await supabase
                .from('missions')
                .select('*')
                .eq('type', 'weekly')
                .eq('is_active', true)
                .limit(5);

            if (fetchError) throw fetchError;
            if (!missions || missions.length === 0) return [];

            const shuffled = missions.sort(() => 0.5 - Math.random());
            const selectedMissions = shuffled.slice(0, 2);

            const userMissions = selectedMissions.map(mission => ({
                user_id: userId,
                mission_id: mission.id,
                progress: { current: 0, required: mission.requirement.count || mission.requirement.total_amount || 1 },
                status: 'active',
                expires_at: this.getEndOfWeek()
            }));

            const { data, error } = await supabase
                .from('user_missions')
                .insert(userMissions)
                .select();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error initializing weekly missions:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Actualizar progreso de misión basado en acción
     */
    async updateProgress(userId, action, metadata = {}) {
        try {
            // Find active missions for this user
            const { data: userMissions, error: fetchError } = await supabase
                .from('user_missions')
                .select(`
                    *,
                    mission:missions(*)
                `)
                .eq('user_id', userId)
                .eq('status', 'active')
                .gte('expires_at', new Date().toISOString());

            if (fetchError) throw fetchError;
            if (!userMissions || userMissions.length === 0) return;

            for (const um of userMissions) {
                const req = um.mission.requirement;

                // Check if this action matches mission requirement
                if (req.action !== action) continue;

                // Check additional conditions
                if (req.min_amount && metadata.amount < req.min_amount) continue;
                if (req.unique_users && metadata.isDuplicate) continue;

                // Update progress
                const progress = um.progress || { current: 0, required: req.count || 1 };

                if (req.total_amount) {
                    // For amount-based missions (e.g., "earn $50k")
                    progress.current = (progress.current || 0) + (metadata.amount || 0);
                } else {
                    // For count-based missions (e.g., "deposit 3 times")
                    progress.current = Math.min(progress.current + 1, progress.required);
                }

                // Check if completed
                const completed = progress.current >= progress.required;
                const status = completed ? 'completed' : 'active';

                await supabase
                    .from('user_missions')
                    .update({
                        progress,
                        status,
                        completed_at: completed ? new Date().toISOString() : null
                    })
                    .eq('id', um.id);

                if (completed) {
                    logger.info(`Mission completed: ${um.mission.name} by user ${userId}`);
                }
            }
        } catch (error) {
            logger.error('Error updating mission progress:', { userId, action, error: error.message });
        }
    }

    /**
     * Obtener misiones activas del usuario
     */
    async getActiveMissions(userId) {
        try {
            const { data, error } = await supabase
                .from('user_missions')
                .select(`
                    *,
                    mission:missions(*)
                `)
                .eq('user_id', userId)
                .gte('expires_at', new Date().toISOString())
                .order('status', { ascending: false })
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Error fetching active missions:', { userId, error: error.message });
            return [];
        }
    }

    /**
     * Reclamar recompensas de misión
     */
    async claimRewards(userId, missionId) {
        try {
            const { data: userMission, error: fetchError } = await supabase
                .from('user_missions')
                .select(`
                    *,
                    mission:missions(*)
                `)
                .eq('user_id', userId)
                .eq('mission_id', missionId)
                .eq('status', 'completed')
                .single();

            if (fetchError || !userMission) {
                return { success: false, error: 'Mission not completed or not found' };
            }

            const rewards = userMission.mission.rewards;

            // Give XP
            if (rewards.xp) {
                await this.addXP(userId, rewards.xp);
            }

            // Give money
            if (rewards.money) {
                const BillingService = require('./BillingService');
                await BillingService.ubService.addMoney(
                    process.env.GUILD_ID,
                    userId,
                    rewards.money,
                    `🎯 Recompensa de misión: ${userMission.mission.name}`,
                    'cash'
                );
            }

            // Mark as claimed
            await supabase
                .from('user_missions')
                .update({
                    status: 'claimed',
                    claimed_at: new Date().toISOString()
                })
                .eq('id', userMission.id);

            logger.info(`Mission rewards claimed: ${userMission.mission.name} by ${userId}`, {
                rewards
            });

            return {
                success: true,
                rewards,
                mission: userMission.mission
            };
        } catch (error) {
            logger.error('Error claiming mission rewards:', { userId, missionId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Reclamar todas las misiones completadas
     */
    async claimAllRewards(userId) {
        try {
            const { data: completedMissions } = await supabase
                .from('user_missions')
                .select(`
                    *,
                    mission:missions(*)
                `)
                .eq('user_id', userId)
                .eq('status', 'completed');

            if (!completedMissions || completedMissions.length === 0) {
                return { success: false, count: 0, error: 'No completed missions' };
            }

            let totalXP = 0;
            let totalMoney = 0;
            const claimedMissions = [];

            for (const um of completedMissions) {
                const result = await this.claimRewards(userId, um.mission_id);
                if (result.success) {
                    totalXP += result.rewards.xp || 0;
                    totalMoney += result.rewards.money || 0;
                    claimedMissions.push(result.mission.name);
                }
            }

            return {
                success: true,
                count: claimedMissions.length,
                totalXP,
                totalMoney,
                missions: claimedMissions
            };
        } catch (error) {
            logger.error('Error claiming all rewards:', { userId, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Agregar XP a usuario
     */
    async addXP(userId, amount) {
        try {
            // Ensure user_stats exists
            const { data: existing } = await supabase
                .from('user_stats')
                .select('*')
                .eq('discord_user_id', userId)
                .single();

            if (!existing) {
                await supabase
                    .from('user_stats')
                    .insert({
                        discord_user_id: userId,
                        xp: amount,
                        commands_used: 0,
                        last_login: new Date().toISOString()
                    });
            } else {
                const newXP = existing.xp + amount;
                await supabase
                    .from('user_stats')
                    .update({ xp: newXP })
                    .eq('discord_user_id', userId);
            }

            logger.info(`Added ${amount} XP to user ${userId}`);
            return true;
        } catch (error) {
            logger.error('Error adding XP:', { userId, amount, error: error.message });
            return false;
        }
    }

    /**
     * Incrementar contador de comandos
     */
    async incrementCommandCount(userId) {
        try {
            const { data: existing } = await supabase
                .from('user_stats')
                .select('commands_used')
                .eq('discord_user_id', userId)
                .single();

            if (!existing) {
                await supabase
                    .from('user_stats')
                    .insert({
                        discord_user_id: userId,
                        commands_used: 1,
                        last_login: new Date().toISOString()
                    });
            } else {
                await supabase
                    .from('user_stats')
                    .update({
                        commands_used: existing.commands_used + 1,
                        last_login: new Date().toISOString()
                    })
                    .eq('discord_user_id', userId);
            }
        } catch (error) {
            logger.error('Error incrementing command count:', { userId, error: error.message });
        }
    }

    /**
     * Obtener fin del día (23:59:59)
     */
    getEndOfDay() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
    }

    /**
     * Obtener fin de la semana (domingo 23:59:59)
     */
    getEndOfWeek() {
        const end = new Date();
        const day = end.getDay();
        const daysUntilSunday = day === 0 ? 0 : 7 - day;
        end.setDate(end.getDate() + daysUntilSunday);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
    }
}

module.exports = new MissionService();
