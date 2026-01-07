const MISSION_POOL = [
const MISSION_POOL = [
    {
        title: 'Operativo de Tránsito',
        description: 'Realiza 3 multas de tránsito justificadas.',
        difficulty: 'easy',
        reward_money: 5000,
        reward_xp: 100,
        requirements: { type: 'traffic_stop', count: 3 }
    },
    {
        title: 'Operativo de Tránsito',
        description: 'Realiza 3 paradas de tránsito y verifica documentación.',
        difficulty: 'medium',
        reward_money: 8000,
        reward_xp: 150,
        requirements: { type: 'traffic_stop', count: 3 }
    },
    {
        title: 'Cero Tolerancia',
        description: 'Realiza 2 arrestos.',
        difficulty: 'medium',
        reward_money: 10000,
        reward_xp: 200,
        requirements: { type: 'arrests', count: 2 }
    },
    {
        title: 'Seguridad Bancaria',
        description: 'Permanece de guardia en servicio (shift) por 15 minutos.',
        difficulty: 'easy',
        reward_money: 4000,
        reward_xp: 80,
        requirements: { type: 'shift_minutes', count: 15 }
    },
    {
        title: 'Respuesta Rápida',
        description: 'Acude a 3 llamados de emergencia (Code 3).',
        difficulty: 'hard',
        reward_money: 12000,
        reward_xp: 250,
        requirements: { type: 'calls', count: 3 }
    },
    {
        title: 'Control de Drogas',
        description: 'Realiza 1 incautación importante (Arresto).',
        difficulty: 'hard',
        reward_money: 15000,
        reward_xp: 300,
        requirements: { type: 'arrests', count: 1 }
    },
    {
        title: 'Apoyo Aéreo',
        description: 'Realiza patrullaje aéreo (20 mins).',
        difficulty: 'medium',
        reward_money: 9000,
        reward_xp: 180,
        requirements: { type: 'shift_minutes', count: 20 }
    }
];

class DailyMissionManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async checkAndRotate() {
        const today = new Date().toISOString().split('T')[0];

        try {
            // Check if mission exists for today
            const { data: existing } = await this.supabase
                .from('daily_missions')
                .select('*')
                .eq('active_date', today)
                .maybeSingle();

            if (existing) {
                // Already exists
                return;
            }

            console.log(`[DailyMissions] No mission for ${today}. Rotating...`);

            // Pick Random
            const template = MISSION_POOL[Math.floor(Math.random() * MISSION_POOL.length)];

            // Insert
            const { error } = await this.supabase
                .from('daily_missions')
                .insert({
                    active_date: today,
                    title: template.title,
                    description: template.description,
                    difficulty: template.difficulty,
                    reward_money: template.reward_money,
                    reward_xp: template.reward_xp,
                    requirements: template.requirements
                });

            if (error) {
                console.error('[DailyMissions] Failed to create mission:', error);
            } else {
                console.log(`[DailyMissions] Created mission: ${template.title}`);
            }

        } catch (e) {
            console.error('[DailyMissions] Error in rotation:', e);
        }
    }

    // --- PROGRESS TRACKING ---
    async reportProgress(discordId, type, amount = 1) {
        const today = new Date().toISOString().split('T')[0];

        try {
            // 1. Get Today's Mission
            const { data: mission } = await this.supabase
                .from('daily_missions')
                .select('*')
                .eq('active_date', today)
                .maybeSingle();

            if (!mission || !mission.requirements) return; // No mission or no reqs

            // Check type match
            if (mission.requirements.type !== type) return;

            const target = mission.requirements.count || 1;

            // 2. Get/Create Completion Record
            let { data: record } = await this.supabase
                .from('mission_completions')
                .select('*')
                .eq('mission_id', mission.id)
                .eq('discord_id', discordId)
                .maybeSingle();

            if (!record) {
                // Create new
                const { data: newRecord, error } = await this.supabase
                    .from('mission_completions')
                    .insert({
                        mission_id: mission.id,
                        discord_id: discordId,
                        progress_current: amount,
                        progress_target: target
                    })
                    .select()
                    .single();

                record = newRecord;
                if (error) throw error;
            } else {
                // Update existing
                if (record.completed_at) return; // Already done

                const newCurrent = (record.progress_current || 0) + amount;

                // Check completion (Allow partial updates? Yes)
                // If it was already completed (completed_at is not null), we skipped above.
                // But we should check if NOW it is completed.

                // Wait, if I just update progress, I need to check if >= target
                // If record.completed_at is NOT null, I returned.

                // So here I update.
                await this.supabase
                    .from('mission_completions')
                    .update({
                        progress_current: newCurrent,
                        progress_target: target,
                        last_update: new Date().toISOString()
                    })
                    .eq('id', record.id);

                record.progress_current = newCurrent;
            }

            // 3. Mark Complete if reached target
            if (record.progress_current >= target && !record.completed_at) {
                await this.supabase
                    .from('mission_completions')
                    .update({
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', record.id);

                console.log(`[DailyMissions] User ${discordId} COMPLETED mission: ${mission.title}`);
                // TODO: Send DM? or just let them know
            }

        } catch (e) {
            console.error('[DailyMissions] Error reporting progress:', e);
        }
    }
}

module.exports = DailyMissionManager;
