-- Migration: fix_admin_counts_rpc.sql
-- Description: Creates a secure function to get detailed election results (vote counts per candidate) bypassing RLS.

CREATE OR REPLACE FUNCTION get_election_results(election_id_param INTEGER)
RETURNS TABLE (
    candidate_id INTEGER,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres), bypassing RLS
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ev.candidate_id,
        COUNT(*)::BIGINT as vote_count
    FROM 
        election_votes ev
    WHERE 
        ev.election_id = election_id_param
    GROUP BY 
        ev.candidate_id;
END;
$$;

-- Grant execution permission to everyone (or restrict to admins if possible, but for this app structure we keep it open)
GRANT EXECUTE ON FUNCTION get_election_results(INTEGER) TO anon, authenticated, service_role;
