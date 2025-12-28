-- ============================================
-- SISTEMA DE GAMIFICACIÓN - NACIÓN MX
-- Misiones, Logros, Niveles y XP
-- ============================================

-- ============================================
-- TABLA: user_stats (Estadísticas y Niveles)
-- ============================================
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT UNIQUE NOT NULL,
    level INT DEFAULT 1 CHECK (level >= 1),
    xp BIGINT DEFAULT 0 CHECK (xp >= 0),
    
    -- Estadísticas financieras
    total_earned BIGINT DEFAULT 0,
    total_spent BIGINT DEFAULT 0,
    total_invested BIGINT DEFAULT 0,
    total_gambled BIGINT DEFAULT 0,
    
    -- Estadísticas de actividad
    commands_used INT DEFAULT 0,
    login_streak INT DEFAULT 0,
    last_login TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(discord_user_id);

-- ============================================
-- TABLA: missions (Misiones Disponibles)
-- ============================================
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'special')),
    category TEXT, -- 'economy', 'business', 'gambling', 'social'
    
    -- Requisitos en formato JSON
    -- Ejemplo: {"action": "deposit", "count": 5, "min_amount": 1000}
    requirement JSONB NOT NULL,
    
    -- Recompensas en formato JSON  
    -- Ejemplo: {"xp": 500, "money": 1000, "items": []}
    rewards JSONB NOT NULL,
    
    difficulty INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT true,
    icon TEXT DEFAULT '📋',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_missions_category ON missions(category) WHERE is_active = true;

-- ============================================
-- TABLA: user_missions (Progreso de Misiones)
-- ============================================
CREATE TABLE IF NOT EXISTS user_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    
    -- Progreso en formato JSON
    -- Ejemplo: {"current": 2, "required": 5}
    progress JSONB DEFAULT '{}'::jsonb,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'claimed')),
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    UNIQUE(user_id, mission_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_status ON user_missions(status);
CREATE INDEX IF NOT EXISTS idx_user_missions_expires ON user_missions(expires_at);

-- ============================================
-- TABLA: achievements (Logros Disponibles)
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆', -- Emoji or URL
    category TEXT, -- 'economy', 'social', 'business', 'combat', 'special'
    
    -- Condición para desbloquear
    -- Ejemplo: {"condition": "total_earned_gte", "value": 1000000}
    requirement JSONB NOT NULL,
    
    -- Recompensas por desbloquear
    -- Ejemplo: {"xp": 10000, "title": "Millonario", "money": 50000}
    rewards JSONB,
    
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    is_hidden BOOLEAN DEFAULT false, -- Secret achievements
    points INT DEFAULT 10, -- Points for achievement system
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- ============================================
-- TABLA: user_achievements (Logros Desbloqueados)
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked_at DESC);

-- ============================================
-- FUNCIÓN: Calcular XP requerido para nivel
-- Formula: 100 * level^2 + 50 * level
-- ============================================
CREATE OR REPLACE FUNCTION xp_required_for_level(level INT)
RETURNS BIGINT AS $$
BEGIN
    IF level < 1 THEN
        RETURN 0;
    END IF;
    RETURN (100 * POWER(level, 2) + 50 * level)::BIGINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- FUNCIÓN: Calcular nivel desde XP total
-- ============================================
CREATE OR REPLACE FUNCTION calculate_level_from_xp(total_xp BIGINT)
RETURNS INT AS $$
DECLARE
    lvl INT := 1;
    required_xp BIGINT;
BEGIN
    IF total_xp < 0 THEN
        RETURN 1;
    END IF;
    
    LOOP
        required_xp := xp_required_for_level(lvl);
        EXIT WHEN total_xp < required_xp;
        lvl := lvl + 1;
        
        -- Safety limit
        EXIT WHEN lvl > 1000;
    END LOOP;
    
    RETURN GREATEST(1, lvl - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- TRIGGER: Auto-actualizar nivel cuando cambia XP
-- ============================================
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.level := calculate_level_from_xp(NEW.xp);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_level ON user_stats;
CREATE TRIGGER trigger_update_level
BEFORE UPDATE OF xp ON user_stats
FOR EACH ROW
EXECUTE FUNCTION update_user_level();

-- ============================================
-- FUNCIÓN: Obtener beneficios por nivel
-- ============================================
CREATE OR REPLACE FUNCTION get_level_benefits(user_level INT)
RETURNS JSONB AS $$
DECLARE
    benefits JSONB := '{}'::jsonb;
BEGIN
    -- Descuento de impuestos
    IF user_level >= 5 THEN
        benefits := jsonb_set(benefits, '{tax_discount}', to_jsonb(5));
    END IF;
    IF user_level >= 10 THEN
        benefits := jsonb_set(benefits, '{tax_discount}', to_jsonb(10));
    END IF;
    IF user_level >= 20 THEN
        benefits := jsonb_set(benefits, '{tax_discount}', to_jsonb(15));
    END IF;
    
    -- Bonus de interés en inversiones
    IF user_level >= 15 THEN
        benefits := jsonb_set(benefits, '{investment_bonus}', to_jsonb(2));
    END IF;
    IF user_level >= 30 THEN
        benefits := jsonb_set(benefits, '{investment_bonus}', to_jsonb(5));
    END IF;
    
    -- Límite de comandos diarios aumentado
    benefits := jsonb_set(benefits, '{daily_command_limit}', to_jsonb(100 + (user_level * 5)));
    
    -- Acceso a características especiales
    IF user_level >= 25 THEN
        benefits := jsonb_set(benefits, '{premium_access}', to_jsonb(true));
    END IF;
    
    RETURN benefits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- DATOS INICIALES: Misiones ejemplo
-- ============================================
INSERT INTO missions (name, description, type, category, requirement, rewards, difficulty, icon) VALUES

-- MISIONES DIARIAS
('Ahorrista Responsable', 'Deposita dinero 3 veces en el banco', 'daily', 'economy',
 '{"action": "deposit", "count": 3, "min_amount": 1000}'::jsonb,
 '{"xp": 500, "money": 2000}'::jsonb, 1, '💰'),

('Inversionista Activo', 'Realiza 2 inversiones (bolsa, plazo fijo, etc)', 'daily', 'investments',
 '{"action": "invest", "count": 2}'::jsonb,
 '{"xp": 1000, "money": 5000}'::jsonb, 2, '📈'),

('Jugador Frecuente', 'Juega 5 veces en el casino', 'daily', 'gambling',
 '{"action": "gamble", "count": 5}'::jsonb,
 '{"xp": 750, "money": 3000}'::jsonb, 2, '🎰'),

('Trabajador Honesto', 'Completa 3 trabajos legales', 'daily', 'economy',
 '{"action": "work", "count": 3}'::jsonb,
 '{"xp": 600, "money": 2500}'::jsonb, 1, '👷'),

('Sociable', 'Transfiere dinero a 3 usuarios diferentes', 'daily', 'social',
 '{"action": "transfer", "count": 3, "unique_users": true}'::jsonb,
 '{"xp": 800, "money": 4000}'::jsonb, 2, '🤝'),

-- MISIONES SEMANALES
('Empresario Exitoso', 'Genera $50,000 en ventas empresariales', 'weekly', 'business',
 '{"action": "business_sales", "total_amount": 50000}'::jsonb,
 '{"xp": 5000, "money": 25000}'::jsonb, 4, '🏢'),

('Magnate Financiero', 'Gana $100,000 en inversiones', 'weekly', 'investments',
 '{"action": "investment_profit", "total_amount": 100000}'::jsonb,
 '{"xp": 7500, "money": 50000}'::jsonb, 5, '💎'),

('Paga tus Deudas', 'Paga $30,000 en créditos', 'weekly', 'economy',
 '{"action": "credit_payment", "total_amount": 30000}'::jsonb,
 '{"xp": 4000, "money": 15000}'::jsonb, 3, '💳')

ON CONFLICT DO NOTHING;

-- ============================================
-- DATOS INICIALES: Logros ejemplo
-- ============================================
INSERT INTO achievements (name, description, icon, category, requirement, rewards, rarity, points) VALUES

-- LOGROS COMUNES
('Primer Paso', 'Ejecuta tu primer comando', '👶', 'general',
 '{"condition": "commands_used_gte", "value": 1}'::jsonb,
 '{"xp": 100}'::jsonb, 'common', 5),

('Novato Activo', 'Usa 100 comandos', '🎯', 'general',
 '{"condition": "commands_used_gte", "value": 100}'::jsonb,
 '{"xp": 1000, "money": 5000}'::jsonb, 'common', 10),

-- LOGROS RAROS
('Primer Millonario', 'Gana $1,000,000 acumulados', '💰', 'economy',
 '{"condition": "total_earned_gte", "value": 1000000}'::jsonb,
 '{"xp": 5000, "money": 50000, "title": "Millonario"}'::jsonb, 'rare', 25),

('Gran Inversor', 'Invierte $500,000 acumulados', '📊', 'investments',
 '{"condition": "total_invested_gte", "value": 500000}'::jsonb,
 '{"xp": 4000, "money": 25000}'::jsonb, 'rare', 20),

-- LOGROS ÉPICOS
('Magnate Empresarial', 'Crea 3 empresas exitosas', '🏢', 'business',
 '{"condition": "companies_created_gte", "value": 3}'::jsonb,
 '{"xp": 10000, "money": 100000, "title": "Magnate"}'::jsonb, 'epic', 50),

('Racha de Suerte', 'Gana 10 veces seguidas en el casino', '🍀', 'gambling',
 '{"condition": "casino_win_streak", "value": 10}'::jsonb,
 '{"xp": 8000, "money": 75000}'::jsonb, 'epic', 40),

-- LOGROS LEGENDARIOS
('Leyenda Económica', 'Alcanza nivel 50', '👑', 'general',
 '{"condition": "level_gte", "value": 50}'::jsonb,
 '{"xp": 50000, "money": 500000, "title": "Leyenda"}'::jsonb, 'legendary', 100),

('Multimillonario', 'Gana $10,000,000 acumulados', '💎', 'economy',
 '{"condition": "total_earned_gte", "value": 10000000}'::jsonb,
 '{"xp": 25000, "money": 250000, "title": "Multimillonario"}'::jsonb, 'legendary', 100)

ON CONFLICT DO NOTHING;

-- ============================================
-- VISTA: user_level_info (Info completa de nivel)
-- ============================================
CREATE OR REPLACE VIEW user_level_info AS
SELECT 
    us.discord_user_id,
    us.level,
    us.xp,
    xp_required_for_level(us.level) AS xp_for_current_level,
    xp_required_for_level(us.level + 1) AS xp_for_next_level,
    xp_required_for_level(us.level + 1) - us.xp AS xp_to_next_level,
    get_level_benefits(us.level) AS benefits,
    (
        CASE 
            WHEN us.level >= 50 THEN 'Legendary'
            WHEN us.level >= 30 THEN 'Epic'
            WHEN us.level >= 15 THEN 'Rare'
            ELSE 'Common'
        END
    ) AS rank,
    us.commands_used,
    us.login_streak,
    us.total_earned,
    us.total_spent,
    us.created_at
FROM user_stats us;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE user_stats IS 'Estadísticas de usuario y sistema de niveles';
COMMENT ON TABLE missions IS 'Catálogo de misiones disponibles';
COMMENT ON TABLE user_missions IS 'Progreso de misiones por usuario';
COMMENT ON TABLE achievements IS 'Catálogo de logros disponibles';
COMMENT ON TABLE user_achievements IS 'Logros desbloqueados por usuario';

-- ============================================
-- FIN DEL SCHEMA
-- ============================================

SELECT 'Gamification system installed successfully!' AS status;
