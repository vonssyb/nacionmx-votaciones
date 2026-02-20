-- Migration: fix_admin_counts_and_dates.sql
-- Description: 
-- 1. Creates a function to get ALL vote counts grouped by candidate (bypassing RLS).
-- 2. Ensures date columns exist.

-- 1. RPC for Admin Counts
CREATE OR REPLACE FUNCTION get_all_votes_grouped()
RETURNS TABLE (
    election_id INTEGER,
    candidate_id INTEGER,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ev.election_id,
        ev.candidate_id,
        COUNT(*)::BIGINT
    FROM 
        election_votes ev
    GROUP BY 
        ev.election_id, ev.candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_votes_grouped() TO anon, authenticated, service_role;

-- 2. RPC for Global Total (for header)
CREATE OR REPLACE FUNCTION get_total_votes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM election_votes);
END;
$$;

GRANT EXECUTE ON FUNCTION get_total_votes() TO anon, authenticated, service_role;
