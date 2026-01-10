-- ============================================================================
-- ERLC Integration Tables
-- ============================================================================

-- Vincular cuentas Roblox <-> Discord
CREATE TABLE IF NOT EXISTS roblox_discord_links (
    id BIGSERIAL PRIMARY KEY,
    roblox_username TEXT NOT NULL UNIQUE,
    roblox_user_id BIGINT,
    discord_user_id TEXT NOT NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roblox_discord_links_roblox ON roblox_discord_links(roblox_username);
CREATE INDEX IF NOT EXISTS idx_roblox_discord_links_discord ON roblox_discord_links(discord_user_id);

-- Log de mensajes de ERLC
CREATE TABLE IF NOT EXISTS erlc_talk_logs (
    id BIGSERIAL PRIMARY KEY,
    roblox_username TEXT NOT NULL,
    discord_user_id TEXT,
    voice_channel_id TEXT,
    text_channel_id TEXT,
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erlc_talk_logs_date ON erlc_talk_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_erlc_talk_logs_user ON erlc_talk_logs(roblox_username);

COMMENT ON TABLE roblox_discord_links IS 'Vinculación entre cuentas de Roblox y Discord';
COMMENT ON TABLE erlc_talk_logs IS 'Historial de mensajes enviados desde ERLC vía :log talk';
