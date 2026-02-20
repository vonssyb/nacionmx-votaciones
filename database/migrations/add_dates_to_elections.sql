-- Migration: add_dates_to_elections.sql
-- Description: Adds start and end dates to elections to support countdown timers

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elections' AND column_name = 'start_date') THEN
        ALTER TABLE elections ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'elections' AND column_name = 'end_date') THEN
        ALTER TABLE elections ADD COLUMN end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
    END IF;
END $$;

-- Update existing elections to have a specific end date (e.g. next Sunday at 20:00) if they are active
-- This ensures the countdown isn't 7 days from "now" regarding migration run time, but somewhat fixed.
-- For now, let's just default to +3 days from now for testing.
UPDATE elections 
SET end_date = (CURRENT_DATE + INTERVAL '3 days' + TIME '20:00:00') AT TIME ZONE 'America/Mexico_City'
WHERE is_active = true;
