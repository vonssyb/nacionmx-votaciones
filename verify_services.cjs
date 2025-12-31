// verify_services.cjs
console.log('🧪 Verifying services load correctly...');

const { createClient } = require('@supabase/supabase-js');

// Mock dependencies
const mockSupabase = { from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: {} }) }) }) }) };
const mockLevelService = { addXP: () => { } };

try {
    console.log('🔄 Loading LevelService...');
    const LevelService = require('./bot/services/LevelService');
    const levelService = new LevelService(mockSupabase);
    console.log('✅ LevelService loaded and instantiated.');

    console.log('🔄 Loading AchievementService...');
    const AchievementService = require('./bot/services/AchievementService');
    const achievementService = new AchievementService(mockSupabase, levelService);
    console.log('✅ AchievementService loaded and instantiated.');

    console.log('🔄 Loading MissionService...');
    const MissionService = require('./bot/services/MissionService');
    const missionService = new MissionService(mockSupabase, levelService);
    console.log('✅ MissionService loaded and instantiated.');

    console.log('🎉 ALL SERVICES VERIFIED! The crash is fixed.');
} catch (error) {
    console.error('❌ Service verification failed:', error);
    process.exit(1);
}
