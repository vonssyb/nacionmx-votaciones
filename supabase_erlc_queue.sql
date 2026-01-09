-- Create Pending ERLC Actions Table
CREATE TABLE IF NOT EXISTS pending_erlc_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command TEXT NOT NULL,
    roblox_username TEXT, -- Optional, for reference
    roblox_id TEXT, -- Optional, for reference
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, completed, failed
    attempts INT DEFAULT 0,
    last_attempt TIMESTAMPTZ,
    error_log TEXT
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_pending_erlc_status ON pending_erlc_actions(status);
