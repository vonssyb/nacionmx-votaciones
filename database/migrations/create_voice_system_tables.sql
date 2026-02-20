-- ====================================
-- VOICE SYSTEM TABLES
-- Sistema avanzado de canales de voz
-- ====================================

-- Canales temporales creados por usuarios
CREATE TABLE IF NOT EXISTS temporary_voice_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT UNIQUE NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    name TEXT NOT NULL,
    user_limit INTEGER DEFAULT 0,
    bitrate INTEGER DEFAULT 64000,
    is_active BOOLEAN DEFAULT true,
    category_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT valid_user_limit CHECK (user_limit >= 0 AND user_limit <= 99),
    CONSTRAINT valid_bitrate CHECK (bitrate >= 8000 AND bitrate <= 384000)
);

-- Índices para canales temporales
CREATE INDEX IF NOT EXISTS idx_temp_channels_owner ON temporary_voice_channels(owner_id);
CREATE INDEX IF NOT EXISTS idx_temp_channels_active ON temporary_voice_channels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_temp_channels_expires ON temporary_voice_channels(expires_at) WHERE expires_at IS NOT NULL;

-- Actividad de voz (tracking de sesiones)
CREATE TABLE IF NOT EXISTS voice_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    was_muted BOOLEAN DEFAULT false,
    was_deafened BOOLEAN DEFAULT false,
    was_streaming BOOLEAN DEFAULT false,
    was_video BOOLEAN DEFAULT false,
    CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- Índices para voice activity
CREATE INDEX IF NOT EXISTS idx_voice_activity_user ON voice_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_activity_channel ON voice_activity(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_activity_joined ON voice_activity(joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_activity_active ON voice_activity(user_id, channel_id) WHERE left_at IS NULL;

-- Configuraciones personalizadas de canales
CREATE TABLE IF NOT EXISTS voice_channel_configs (
    channel_id TEXT PRIMARY KEY,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT,
    is_locked BOOLEAN DEFAULT false,
    whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
    blacklist TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Índice para configuraciones
CREATE INDEX IF NOT EXISTS idx_channel_configs_updated ON voice_channel_configs(updated_at DESC);

-- Logs de whisper (para moderación y auditoría)
CREATE TABLE IF NOT EXISTS whisper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration_seconds INTEGER,
    temp_channel_id TEXT,
    was_successful BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para whisper logs
CREATE INDEX IF NOT EXISTS idx_whisper_from_user ON whisper_logs(from_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whisper_to_user ON whisper_logs(to_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whisper_timestamp ON whisper_logs(timestamp DESC);

-- Estadísticas agregadas de voz (para performance)
CREATE TABLE IF NOT EXISTS voice_stats_summary (
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    channels_visited TEXT[] DEFAULT ARRAY[]::TEXT[],
    peak_concurrent_users INTEGER DEFAULT 1,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- Índice para estadísticas
CREATE INDEX IF NOT EXISTS idx_voice_stats_date ON voice_stats_summary(date DESC);
CREATE INDEX IF NOT EXISTS idx_voice_stats_user_date ON voice_stats_summary(user_id, date DESC);

-- Función para calcular duración automáticamente
CREATE OR REPLACE FUNCTION calculate_voice_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.left_at IS NOT NULL AND NEW.joined_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular duración
DROP TRIGGER IF EXISTS trg_calculate_voice_duration ON voice_activity;
CREATE TRIGGER trg_calculate_voice_duration
    BEFORE INSERT OR UPDATE ON voice_activity
    FOR EACH ROW
    EXECUTE FUNCTION calculate_voice_duration();

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at en configs
DROP TRIGGER IF EXISTS trg_update_channel_config_timestamp ON voice_channel_configs;
CREATE TRIGGER trg_update_channel_config_timestamp
    BEFORE UPDATE ON voice_channel_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vista para estadísticas de usuario (para queries rápidas)
CREATE OR REPLACE VIEW user_voice_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_sessions,
    SUM(duration_seconds) as total_duration_seconds,
    ROUND(AVG(duration_seconds)) as avg_session_duration,
    MAX(duration_seconds) as longest_session,
    COUNT(DISTINCT channel_id) as unique_channels,
    MAX(left_at) as last_voice_activity
FROM voice_activity
WHERE left_at IS NOT NULL
GROUP BY user_id;

-- Vista para canales más populares
CREATE OR REPLACE VIEW popular_voice_channels AS
SELECT 
    channel_id,
    channel_name,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_sessions,
    SUM(duration_seconds) as total_duration_seconds,
    ROUND(AVG(duration_seconds)) as avg_session_duration
FROM voice_activity
WHERE left_at IS NOT NULL AND channel_name IS NOT NULL
GROUP BY channel_id, channel_name
ORDER BY unique_users DESC, total_sessions DESC;

-- Comentarios para documentación
COMMENT ON TABLE temporary_voice_channels IS 'Canales de voz temporales creados por usuarios';
COMMENT ON TABLE voice_activity IS 'Registro de actividad en canales de voz';
COMMENT ON TABLE voice_channel_configs IS 'Configuraciones personalizadas de canales de voz';
COMMENT ON TABLE whisper_logs IS 'Registro de whispers/susurros entre usuarios';
COMMENT ON TABLE voice_stats_summary IS 'Estadísticas agregadas por usuario y fecha';
COMMENT ON VIEW user_voice_statistics IS 'Vista con estadísticas de voz por usuario';
COMMENT ON VIEW popular_voice_channels IS 'Vista con canales de voz más populares';
