-- Arrests and Fines System for Nación MX
-- Police arrests and traffic fines with penal code integration

CREATE TABLE IF NOT EXISTS arrests (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT NOT NULL,
    arrested_by TEXT NOT NULL,
    arrested_by_tag TEXT NOT NULL,
    articles TEXT NOT NULL,
    arrest_time INTEGER NOT NULL,
    release_time TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    evidence_url TEXT NOT NULL,
    fine_amount INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS traffic_fines (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT NOT NULL,
    issued_by TEXT NOT NULL,
    issued_by_tag TEXT NOT NULL,
    article TEXT DEFAULT 'Art. 60',
    fine_amount INTEGER DEFAULT 2000,
    observations TEXT,
    evidence_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arrests_user ON arrests(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_arrests_time ON arrests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fines_user ON traffic_fines(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_fines_time ON traffic_fines(created_at DESC);
