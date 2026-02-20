-- Migration: Remove nationality field from citizen_dni
-- All citizens are Mexican by default now
-- American roles will use the visa system instead

-- Step 1: Remove the nationality column
ALTER TABLE public.citizen_dni DROP COLUMN IF EXISTS nacionalidad;

-- Step 2: Add comment to clarify
COMMENT ON TABLE public.citizen_dni IS 'Citizen identification records for RP - All citizens are Mexican. Americans use visa system (see american_visas table)';

-- Note: Existing data with nacionalidad will be preserved in backups before this migration
