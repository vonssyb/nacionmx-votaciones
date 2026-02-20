-- ============================================
-- COMPREHENSIVE FIX FOR ALL KNOWN ISSUES
-- ============================================
-- Run ALL of these in Supabase SQL Editor

-- 1. Add discord_user_id to credit_cards
ALTER TABLE credit_cards 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_credit_cards_discord_user_id 
ON credit_cards(discord_user_id);

-- 2. Remove outdated card_type constraint
ALTER TABLE credit_cards 
DROP CONSTRAINT IF EXISTS credit_cards_card_type_check;

-- 3. Create giro_transfers table
CREATE TABLE IF NOT EXISTS giro_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reason TEXT,
    release_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_giro_transfers_receiver ON giro_transfers(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_giro_transfers_release_date ON giro_transfers(release_date) WHERE status = 'pending';

-- Done! All SQL fixes applied.
