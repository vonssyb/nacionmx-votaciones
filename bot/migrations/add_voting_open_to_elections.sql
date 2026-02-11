-- Migration: add_voting_open_to_elections.sql
-- Description: Adds a flag to control if voting is open for an election (independent of visibility)

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elections' AND column_name = 'voting_open') THEN
        ALTER TABLE elections ADD COLUMN voting_open BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
