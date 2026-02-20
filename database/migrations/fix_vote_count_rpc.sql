-- Migration: fix_vote_count_rpc.sql
-- Description: Creates a secure function to get total votes count, bypassing RLS.

CREATE OR REPLACE FUNCTION get_total_votes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres), bypassing RLS
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM election_votes);
END;
$$;

-- Grant access to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_total_votes() TO anon, authenticated, service_role;
