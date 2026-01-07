-- Add progress tracking columns to mission_completions
ALTER TABLE mission_completions
ADD COLUMN IF NOT EXISTS progress_current numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_target numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_update timestamp with time zone DEFAULT now();

-- Index for efficient progress lookups
CREATE INDEX IF NOT EXISTS idx_mission_completions_progress 
ON mission_completions(discord_id, mission_id);
