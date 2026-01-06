class MissionService {
    constructor(supabaseClient, levelService) {
        this.supabase = supabaseClient;
        this.levelService = levelService;
    }
    async initializeDailyMissions(userId) {
        try {
            console.log(`Initializing daily missions for user ${userId}`);

            const { data: missions, error: fetchError } = await this.supabase
                .from('missions')
                .select('*')
                .eq('type', 'daily')
                .eq('is_active', true)
                .limit(10);

            if (fetchError) throw fetchError;
            if (!missions || missions.length === 0) {
                console.warn('No daily missions available');
                return [];
            }

            const shuffled = missions.sort(() => 0.5 - Math.random());
            const selectedMissions = shuffled.slice(0, 3);

            const userMissions = selectedMissions.map(mission => ({
                user_id: userId,
                mission_id: mission.id,
                progress: { current: 0, required: mission.requirement.count || 1 },
                status: 'active',
                expires_at: this.getEndOfDay()
            }));

            const { data, error } = await this.supabase
                .from('user_missions')
                .insert(userMissions)
                .select();

            if (error) throw error;

            console.log(`Initialized ${data.length} daily missions for user ${userId}`);
            return data;
        } catch (error) {
            console.error('Error initializing daily missions:', { userId, error: error.message });
            return [];
        }
    }

    async updateProgress(userId, action, metadata = {}) {
        try {
            const { data: userMissions, error: fetchError } = await this.supabase
                .from('user_missions')
                .select(`*,mission:missions(*)`)
                .eq('user_id', userId)
                .eq('status', 'active')
                .gte('expires_at', new Date().toISOString());

            if (fetchError) throw fetchError;
            if (!userMissions || userMissions.length === 0) return;

            for (const um of userMissions) {
                const req = um.mission.requirement;

                if (req.action !== action) continue;
                if (req.min_amount && metadata.amount < req.min_amount) continue;

                const progress = um.progress || { current: 0, required: req.count || 1 };

                if (req.total_amount) {
                    progress.current = (progress.current || 0) + (metadata.amount || 0);
                } else {
                    progress.current = Math.min(progress.current + 1, progress.required);
                }

                const completed = progress.current >= progress.required;

                await this.supabase
                    .from('user_missions')
                    .update({
                        progress,
                        status: completed ? 'completed' : 'active',
                        completed_at: completed ? new Date().toISOString() : null
                    })
                    .eq('id', um.id);

                if (completed) {
                    console.log(`Mission completed: ${um.mission.name} by user ${userId}`);
                }
            }
        } catch (error) {
            console.error('Error updating mission progress:', { userId, action, error: error.message });
        }
    }

    async claimRewards(userId, missionId) {
        try {
            const { data: userMission, error: fetchError } = await this.supabase
                .from('user_missions')
                .select(`*,mission:missions(*)`)
                .eq('user_id', userId)
                .eq('mission_id', missionId)
                .eq('status', 'completed')
                .single();

            if (fetchError || !userMission) {
                return { success: false, error: 'Mission not completed' };
            }

            const rewards = userMission.mission.rewards;

            if (rewards.xp && this.levelService) {
                // Use Central Level Service
                await this.levelService.addXP(userId, rewards.xp);
            }

            if (rewards.money) {
                // LAZY LOAD to avoid circular dependency
                const BillingService = require('./BillingService');
                await BillingService.ubService.addMoney(
                    process.env.GUILD_ID,
                    userId,
                    rewards.money,
                    `🎯 Recompensa: ${userMission.mission.name}`,
                    'cash'
                );
            }

            await this.supabase
                .from('user_missions')
                .update({ status: 'claimed', claimed_at: new Date().toISOString() })
                .eq('id', userMission.id);

            console.log(`Mission claimed: ${userMission.mission.name} by ${userId}`);

            return { success: true, rewards, mission: userMission.mission };
        } catch (error) {
            console.error('Error claiming rewards:', { userId, missionId, error: error.message });
            return { success: false, error: error.message };
        }
    }



    getEndOfDay() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
    }
}

module.exports = MissionService;
