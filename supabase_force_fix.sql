-- FORCE PERMISSIONS FIX
-- Run this in Supabase SQL Editor

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS session_vote_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session_votes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    vote_type TEXT CHECK(vote_type IN ('yes', 'late', 'no')),
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- 2. Force Enable RLS
ALTER TABLE session_vote_participants ENABLE ROW LEVEL SECURITY;

-- 3. Nuke existing policies
DROP POLICY IF EXISTS "Public read vote_participants" ON session_vote_participants;
DROP POLICY IF EXISTS "Public insert vote_participants" ON session_vote_participants;
DROP POLICY IF EXISTS "Public update vote_participants" ON session_vote_participants;
DROP POLICY IF EXISTS "Allow all" ON session_vote_participants;

-- 4. Create "Open Door" Policy
CREATE POLICY "Allow all" ON session_vote_participants
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Grant explicit permissions to service_role and anon
GRANT ALL ON session_vote_participants TO anon;
GRANT ALL ON session_vote_participants TO authenticated;
GRANT ALL ON session_vote_participants TO service_role;

-- 6. Verify table exists in public schema
COMMENT ON TABLE session_vote_participants IS 'Voting table fixed by bot';
