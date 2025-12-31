-- FIX: Ensure session_vote_participants table exists and has correct permissions
-- The bot uses 'session_vote_participants', not 'vote_responses'

CREATE TABLE IF NOT EXISTS session_vote_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session_votes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    vote_type TEXT CHECK(vote_type IN ('yes', 'late', 'no')),
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE session_vote_participants ENABLE ROW LEVEL SECURITY;

-- CLEAR EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "Public read vote_participants" ON session_vote_participants;
DROP POLICY IF EXISTS "Public insert vote_participants" ON session_vote_participants;
DROP POLICY IF EXISTS "Public update vote_participants" ON session_vote_participants;

-- CREATE PERMISSIVE POLICIES (Bot handles logic)
CREATE POLICY "Public read vote_participants" ON session_vote_participants FOR SELECT USING (true);
CREATE POLICY "Public insert vote_participants" ON session_vote_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update vote_participants" ON session_vote_participants FOR UPDATE USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_vote_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON session_vote_participants(user_id);

-- Verify logic: Count votes for a session
CREATE OR REPLACE FUNCTION get_vote_counts(session_uuid UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    yes_count INTEGER;
    late_count INTEGER;
    no_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO yes_count FROM session_vote_participants WHERE session_id = session_uuid AND vote_type = 'yes';
    SELECT COUNT(*) INTO late_count FROM session_vote_participants WHERE session_id = session_uuid AND vote_type = 'late';
    SELECT COUNT(*) INTO no_count FROM session_vote_participants WHERE session_id = session_uuid AND vote_type = 'no';
    
    RETURN json_build_object(
        'yes', yes_count,
        'late', late_count,
        'no', no_count
    );
END;
$$;
