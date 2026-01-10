CREATE TABLE IF NOT EXISTS bot_heartbeats (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy to allow any operation for now (or restrict as needed)
ALTER TABLE bot_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to bot_heartbeats"
ON bot_heartbeats
FOR ALL
USING (true)
WITH CHECK (true);
