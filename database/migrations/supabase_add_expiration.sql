-- Add expiration columns to sanctions table
ALTER TABLE sanctions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT NULL;

-- Index for faster expiration checks
CREATE INDEX IF NOT EXISTS idx_sanctions_expires_at ON sanctions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sanctions_status_expires ON sanctions(status, expires_at);
