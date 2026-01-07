-- Add backup_data column to ck_registry if it doesn't exist
ALTER TABLE ck_registry ADD COLUMN IF NOT EXISTS backup_data JSONB;

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_ck_registry_user ON ck_registry(user_id);
