-- Migration: add_folio_and_public_results.sql
-- Description: Adds a 'folio' column to election_votes and creates a secure RPC for public results.

-- 1. Add 'folio' column to 'election_votes' if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'election_votes' AND column_name = 'folio') THEN
        ALTER TABLE election_votes ADD COLUMN folio UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 2. Create RPC to get public results (ONLY for closed elections)
CREATE OR REPLACE FUNCTION get_public_results(election_id_param BIGINT)
RETURNS TABLE (
    candidate_id BIGINT,
    vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    election_end TIMESTAMPTZ;
BEGIN
    -- Check if election exists and is closed (end_date < NOW)
    SELECT end_date INTO election_end
    FROM elections
    WHERE id = election_id_param;

    -- If election not found or still open, return empty
    IF election_end IS NULL OR election_end > NOW() THEN
        RETURN;
    END IF;

    -- Return grouped vote counts
    RETURN QUERY
    SELECT ev.candidate_id, COUNT(*) as vote_count
    FROM election_votes ev
    WHERE ev.election_id = election_id_param
    GROUP BY ev.candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_results(BIGINT) TO anon, authenticated, service_role;
