CREATE TABLE IF NOT EXISTS erlc_log_state (
    id INT PRIMARY KEY DEFAULT 1,
    state_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize with default if empty
INSERT INTO erlc_log_state (id, state_data)
VALUES (1, '{"lastKill": 0, "lastCommand": 0, "lastJoin": 0, "processedKills": [], "processedCommands": [], "processedJoins": []}')
ON CONFLICT (id) DO NOTHING;
