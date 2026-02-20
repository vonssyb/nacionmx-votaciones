-- Session Voting System Tables
-- Run this in Supabase SQL Editor

-- 1. Session votes table
CREATE TABLE IF NOT EXISTS session_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    minimum_votes INTEGER DEFAULT 4,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'opened', 'cancelled')),
    message_id TEXT,
    channel_id TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vote responses table
CREATE TABLE IF NOT EXISTS vote_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session_votes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    vote_type TEXT CHECK(vote_type IN ('yes', 'late', 'no')),
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_status ON session_votes(status);
CREATE INDEX IF NOT EXISTS idx_session_created_by ON session_votes(created_by);
CREATE INDEX IF NOT EXISTS idx_vote_session ON vote_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_vote_user ON vote_responses(user_id);

-- 4. RLS Policies
ALTER TABLE session_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;

-- Allow read access for all
CREATE POLICY "Public read session_votes" ON session_votes FOR SELECT USING (true);
CREATE POLICY "Public read vote_responses" ON vote_responses FOR SELECT USING (true);

-- Allow insert/update for all (bot will handle permissions)
CREATE POLICY "Public insert session_votes" ON session_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update session_votes" ON session_votes FOR UPDATE USING (true);
CREATE POLICY "Public insert vote_responses" ON vote_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update vote_responses" ON vote_responses FOR UPDATE USING (true);
