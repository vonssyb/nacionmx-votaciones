-- Tabla para vinculación Roblox <-> Discord
CREATE TABLE IF NOT EXISTS roblox_discord_links (
    id BIGSERIAL PRIMARY KEY,
    roblox_username TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(discord_user_id),
    UNIQUE(roblox_username)
);

-- Tabla para logs de mensajes ERLC
CREATE TABLE IF NOT EXISTS erlc_talk_logs (
    id BIGSERIAL PRIMARY KEY,
    roblox_username TEXT,
    discord_user_id TEXT,
    voice_channel_id TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
