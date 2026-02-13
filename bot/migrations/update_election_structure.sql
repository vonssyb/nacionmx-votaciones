-- Migration: update_election_structure.sql
-- Description: Adds date columns to elections for the timer and creates a secure vote counting function.

-- 1. Add start_date and end_date columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elections' AND column_name = 'start_date') THEN
        ALTER TABLE elections ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elections' AND column_name = 'end_date') THEN
        ALTER TABLE elections ADD COLUMN end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
    END IF;
END $$;

-- 2. Update existing active elections to have a default end date (e.g., Feb 15, 2026, 20:00)
-- Adjust this date as needed.
UPDATE elections 
SET end_date = '2026-02-15 20:00:00-06'
WHERE is_active = true AND end_date IS NULL;

-- 3. Create Secure Vote Counting Function (RPC)
-- This allows fetching the total number of votes without exposing who voted for whom (bypassing RLS).
CREATE OR REPLACE FUNCTION get_total_votes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM election_votes);
END;
$$;

-- Grant execution permission to everyone
GRANT EXECUTE ON FUNCTION get_total_votes() TO anon, authenticated, service_role;

-- 4. Enable Public Read on Election Dates (if not covered by existing policy)
-- (Existing policy "Public read elections" usually covers SELECT * using true, so this is fine)
