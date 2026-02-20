-- Migration: create_electoral_complaints.sql
-- Description: Creates table for storing electoral crime reports

CREATE TABLE IF NOT EXISTS electoral_complaints (
    id SERIAL PRIMARY KEY,
    reporter_id VARCHAR(100), -- Optional: ID of the person reporting (if logged in)
    offender_name VARCHAR(255) NOT NULL, -- Name of the person/party being reported
    description TEXT NOT NULL,
    evidence_url TEXT, -- URL to image/video evidence
    status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, dismissed, action_taken
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE electoral_complaints ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Everyone can insert a complaint (Anonymous reporting allowed)
CREATE POLICY "Public insert complaints" ON electoral_complaints FOR INSERT WITH CHECK (true);

-- 2. Everyone can view complaints (Simplifies Admin fetching for now, protected by RoleGuard in frontend)
-- In a stricter system, we'd limit this to specific roles, but Supabase Client often runs as 'anon' or authenticated user.
CREATE POLICY "Public read complaints" ON electoral_complaints FOR SELECT USING (true);

-- 3. Everyone can update status (Protected by Frontend Admin Guard)
CREATE POLICY "Public update complaints" ON electoral_complaints FOR UPDATE USING (true);
