-- Migration: fix_global_count_active.sql
-- Description: Updates get_total_votes to only count votes for ACTIVE elections, excluding old/archived ones.

CREATE OR REPLACE FUNCTION get_total_votes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM election_votes ev
        JOIN elections e ON ev.election_id = e.id
        WHERE e.is_active = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_total_votes() TO anon, authenticated, service_role;
