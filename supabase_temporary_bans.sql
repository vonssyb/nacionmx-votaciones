-- Tabla para rastrear bans temporales y auto-desbanear
CREATE TABLE IF NOT EXISTS temporary_bans (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT,
    banned_by TEXT NOT NULL,
    banned_by_tag TEXT,
    ban_type TEXT NOT NULL, -- 'discord' o 'erlc'
    reason TEXT,
    duration_minutes INTEGER NOT NULL,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    unbanned BOOLEAN DEFAULT FALSE,
    unbanned_at TIMESTAMPTZ,
    roblox_id TEXT, -- For ERLC unbans
    roblox_username TEXT, -- For ERLC unbans
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_temp_bans_expires ON temporary_bans(expires_at) WHERE unbanned = FALSE;
CREATE INDEX IF NOT EXISTS idx_temp_bans_user ON temporary_bans(user_id, ban_type) WHERE unbanned = FALSE;
CREATE INDEX IF NOT EXISTS idx_temp_bans_guild ON temporary_bans(guild_id) WHERE unbanned = FALSE;

-- RLS (Row Level Security)
ALTER TABLE temporary_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for service role"
ON temporary_bans
FOR ALL
TO service_role
USING (true);

CREATE POLICY "Allow read for authenticated users"
ON temporary_bans
FOR SELECT
TO authenticated
USING (true);
