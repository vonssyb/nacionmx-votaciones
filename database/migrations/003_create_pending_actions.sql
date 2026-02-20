-- Migration: Create pending_actions table
-- Purpose: Replace global.pendingActions with persistent storage
-- Date: 2026-01-20

-- Create table
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_hash TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_actions_hash ON pending_actions(action_hash);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires ON pending_actions(expires_at);

-- Create index for JSON queries (userId lookup)
CREATE INDEX IF NOT EXISTS idx_pending_actions_user ON pending_actions 
  USING gin ((data->'userId'));

-- Add comment
COMMENT ON TABLE pending_actions IS 'Stores temporary action states (AI approvals, button interactions, etc)';

-- Auto-cleanup function (optional, can also use periodic job)
CREATE OR REPLACE FUNCTION cleanup_expired_actions()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_actions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-pending-actions', '*/5 * * * *', 'SELECT cleanup_expired_actions()');

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON pending_actions TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON pending_actions TO service_role;
