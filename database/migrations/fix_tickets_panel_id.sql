-- Fix tickets table to match ticketHandler.js expectations
-- This migration aligns the database schema with the code

-- 1. Add missing columns if they don't exist
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS creator_id TEXT,
ADD COLUMN IF NOT EXISTS claimed_by_id TEXT,
ADD COLUMN IF NOT EXISTS panel_id BIGINT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS rating INTEGER,
ADD COLUMN IF NOT EXISTS feedback_comments TEXT,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Copy data from old columns to new ones (if data exists)
UPDATE tickets SET creator_id = user_id WHERE creator_id IS NULL;
UPDATE tickets SET claimed_by_id = claimed_by WHERE claimed_by_id IS NULL;
UPDATE tickets SET type = ticket_type WHERE type IS NULL;

-- 3. Rename status values to match code expectations (OPEN, CLOSED, PAUSED)
UPDATE tickets SET status = 'OPEN' WHERE status = 'open';
UPDATE tickets SET status = 'CLOSED' WHERE status = 'closed';

-- 4. Make sure status column is uppercase by default
ALTER TABLE tickets ALTER COLUMN status SET DEFAULT 'OPEN';

-- Note: We keep the old columns (user_id, claimed_by, ticket_type) for backwards compatibility
-- They can be dropped later once everything is migrated

