-- Tax Evasion History Table
CREATE TABLE IF NOT EXISTS tax_evasion_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    evasion_type TEXT NOT NULL CHECK (evasion_type IN ('success', 'caught', 'audit')),
    tax_amount BIGINT NOT NULL,
    fine_amount BIGINT DEFAULT 0,
    suspicion_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tax_history_user ON tax_evasion_history(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tax_history_date ON tax_evasion_history(created_at);

-- RLS Policies
ALTER TABLE tax_evasion_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage tax history"
ON tax_evasion_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
