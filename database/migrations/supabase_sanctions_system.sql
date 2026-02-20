-- Create Sanctions Table
CREATE TABLE IF NOT EXISTS sanctions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('notificacion', 'sa', 'general')),
    reason TEXT NOT NULL,
    evidence_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'appealed', 'archived', 'canceled'))
);

-- Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_sanctions_user_id ON sanctions(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_type ON sanctions(type);

-- Policy for viewing (if RLS is enabled, though often not for bot role, good practice)
ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot and Admins can view all sanctions"
ON sanctions FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Bot and Admins can insert sanctions"
ON sanctions FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Bot and Admins can update sanctions"
ON sanctions FOR UPDATE
TO service_role
USING (true);
