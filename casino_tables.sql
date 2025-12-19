-- ================================================
-- 🎰 CASINO NACIÓN MX - TABLAS DE BASE DE DATOS
-- ================================================

-- Tabla de fichas de casino
CREATE TABLE IF NOT EXISTS casino_chips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL UNIQUE,
    chips_balance INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_lost INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    biggest_win INTEGER DEFAULT 0,
    biggest_loss INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_casino_chips_user ON casino_chips(discord_user_id);

-- Tabla de historial de juegos
CREATE TABLE IF NOT EXISTS casino_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    game_type TEXT NOT NULL, -- 'blackjack', 'slots', 'crash', etc
    bet_amount INTEGER NOT NULL,
    result_amount INTEGER NOT NULL, -- positivo = ganó, negativo = perdió
    multiplier DECIMAL(10,2) DEFAULT 1.0,
    game_data JSONB, -- datos específicos del juego (cartas, números, etc)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_casino_history_user ON casino_history(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_casino_history_game ON casino_history(game_type);
CREATE INDEX IF NOT EXISTS idx_casino_history_date ON casino_history(created_at DESC);

-- Tabla de accesos al casino (entrada)
CREATE TABLE IF NOT EXISTS casino_access (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    access_type TEXT DEFAULT 'paid', -- 'paid' o 'vip'
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casino_access_user ON casino_access(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_casino_access_expires ON casino_access(expires_at);

-- Tabla de bans del casino
CREATE TABLE IF NOT EXISTS casino_bans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    reason TEXT,
    banned_by TEXT,
    banned_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casino_bans_user ON casino_bans(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_casino_bans_until ON casino_bans(banned_until);

-- Tabla de salas multijugador
CREATE TABLE IF NOT EXISTS casino_multiplayer_rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_type TEXT NOT NULL, -- 'poker', 'blackjack-multi', etc
    room_code TEXT UNIQUE NOT NULL,
    max_players INTEGER DEFAULT 6,
    current_players INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    pot_total INTEGER DEFAULT 0,
    game_state JSONB, -- estado del juego
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_code ON casino_multiplayer_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_status ON casino_multiplayer_rooms(status);

-- Tabla de jugadores en salas
CREATE TABLE IF NOT EXISTS casino_room_players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_id UUID REFERENCES casino_multiplayer_rooms(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    bet_amount INTEGER NOT NULL,
    current_balance INTEGER DEFAULT 0,
    position INTEGER,
    status TEXT DEFAULT 'active', -- 'active', 'folded', 'eliminated'
    player_data JSONB, -- cartas, fichas, etc
    joined_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_players_room ON casino_room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON casino_room_players(discord_user_id);

-- Tabla de límites diarios (anti-trampa)
CREATE TABLE IF NOT EXISTS casino_daily_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    chips_purchased INTEGER DEFAULT 0,
    total_wagered INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(discord_user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_limits_user_date ON casino_daily_limits(discord_user_id, date);

-- Tabla de logros del casino
CREATE TABLE IF NOT EXISTS casino_achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL, -- 'first_win', 'jackpot', 'lucky_7', etc
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(discord_user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON casino_achievements(discord_user_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_casino_chips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_casino_chips ON casino_chips;
CREATE TRIGGER trigger_update_casino_chips
    BEFORE UPDATE ON casino_chips
    FOR EACH ROW
    EXECUTE FUNCTION update_casino_chips_updated_at();

-- Vista para ranking de jugadores
CREATE OR REPLACE VIEW casino_leaderboard AS
SELECT 
    c.discord_user_id,
    c.chips_balance,
    c.total_won,
    c.total_lost,
    (c.total_won - c.total_lost) as net_profit,
    c.games_played,
    c.biggest_win,
    RANK() OVER (ORDER BY c.chips_balance DESC) as rank
FROM casino_chips c
WHERE c.chips_balance > 0
ORDER BY c.chips_balance DESC
LIMIT 100;

-- ================================================
-- POLÍTICAS RLS (Row Level Security)
-- ================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE casino_chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_daily_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_achievements ENABLE ROW LEVEL SECURITY;

-- Políticas: Service role puede hacer todo
CREATE POLICY "Service role can do everything on casino_chips"
ON casino_chips FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_history"
ON casino_history FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_access"
ON casino_access FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_bans"
ON casino_bans FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_multiplayer_rooms"
ON casino_multiplayer_rooms FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_room_players"
ON casino_room_players FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_daily_limits"
ON casino_daily_limits FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on casino_achievements"
ON casino_achievements FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================
-- DATOS INICIALES
-- ================================================

-- Logros predefinidos (solo para referencia, se crean dinámicamente)
-- 'first_win' - Primera victoria
-- 'jackpot' - Ganar un jackpot de slots
-- 'lucky_7' - Ganar 7 veces seguidas
-- 'high_roller' - Apostar más de 10k fichas
-- 'survivor' - Sobrevivir ruleta rusa 5 veces
-- 'horse_master' - Ganar 10 carreras de caballos
-- 'blackjack_pro' - Conseguir 5 blackjacks seguidos
-- 'millionaire' - Tener 1M+ fichas

COMMENT ON TABLE casino_chips IS 'Balance de fichas y estadísticas de cada jugador';
COMMENT ON TABLE casino_history IS 'Historial completo de todas las partidas jugadas';
COMMENT ON TABLE casino_access IS 'Control de acceso al casino (entrada pagada o VIP)';
COMMENT ON TABLE casino_bans IS 'Jugadores baneados del casino temporalmente';
COMMENT ON TABLE casino_multiplayer_rooms IS 'Salas de juegos multijugador activas';
COMMENT ON TABLE casino_room_players IS 'Jugadores en cada sala multijugador';
COMMENT ON TABLE casino_daily_limits IS 'Límites diarios por jugador (anti-trampa)';
COMMENT ON TABLE casino_achievements IS 'Logros desbloqueados por jugadores';
