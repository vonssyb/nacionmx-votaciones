-- Migration: allow_public_vote_counts.sql
-- Description: Allow all authenticated users to read votes (Required for client-side counting in Admin Panel)

-- 1. Drop the restrictive policy (See own votes only)
DROP POLICY IF EXISTS "Users can see their own votes" ON election_votes;

-- 2. Create a permissive policy for SELECT
-- This allows the Admin Dashboard to fetch all votes and count them.
-- WARNING: This technically allows any logged-in user to query the votes table if they know how.
-- Given the client-side architecture, this is necessary.
CREATE POLICY "Enable read access for all users" ON election_votes FOR SELECT USING (true);

-- Optional: Ensure INSERT is still restricted (already handled by "Users can vote" policy in add_election_system.sql, but good to double check)
-- We don't change INSERT policies here.
