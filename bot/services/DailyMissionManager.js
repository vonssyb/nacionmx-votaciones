const MISSION_POOL = [
    {
        title: 'Patrullaje Preventivo',
        description: 'Realiza un patrullaje de al menos 30 minutos por zonas conflictivas.',
        difficulty: 'easy',
        reward_money: 5000,
        reward_xp: 100
    },
    {
        title: 'Operativo de Tránsito',
        description: 'Realiza 3 paradas de tránsito y verifica documentación.',
        difficulty: 'medium',
        reward_money: 8000,
        reward_xp: 150
    },
    {
        title: 'Cero Tolerancia',
        description: 'Realiza 2 arrestos o 3 multas justificadas.',
        difficulty: 'medium',
        reward_money: 10000,
        reward_xp: 200
    },
    {
        title: 'Seguridad Bancaria',
        description: 'Permanece de guardia en el banco o joyería por 15 minutos.',
        difficulty: 'easy',
        reward_money: 4000,
        reward_xp: 80
    },
    {
        title: 'Respuesta Rápida',
        description: 'Acude a 3 llamados de emergencia (Code 3).',
        difficulty: 'hard',
        reward_money: 12000,
        reward_xp: 250
    },
    {
        title: 'Control de Drogas',
        description: 'Confisca artículos ilegales en un registro.',
        difficulty: 'hard',
        reward_money: 15000,
        reward_xp: 300
    },
    {
        title: 'Apoyo Aéreo',
        description: 'Realiza patrullaje aéreo o apoyo desde helicóptero.',
        difficulty: 'medium',
        reward_money: 9000,
        reward_xp: 180
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
                    reward_xp: template.reward_xp
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
}

module.exports = DailyMissionManager;
