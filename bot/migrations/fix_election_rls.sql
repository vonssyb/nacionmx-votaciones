-- Migration: fix_election_rls.sql
-- Description: Allow public management of elections and candidates (Protected by Frontend RoleGuard)

-- DROP existing policies if needed (optional, or just add new ones)
-- DROP POLICY IF EXISTS "Public read elections" ON elections;
-- DROP POLICY IF EXISTS "Public read candidates" ON election_candidates;

-- Add policies for INSERT, UPDATE, DELETE for 'elections'
CREATE POLICY "Public insert elections" ON elections FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update elections" ON elections FOR UPDATE USING (true);
CREATE POLICY "Public delete elections" ON elections FOR DELETE USING (true);

-- Add policies for INSERT, UPDATE, DELETE for 'election_candidates'
CREATE POLICY "Public insert candidates" ON election_candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update candidates" ON election_candidates FOR UPDATE USING (true);
CREATE POLICY "Public delete candidates" ON election_candidates FOR DELETE USING (true);
