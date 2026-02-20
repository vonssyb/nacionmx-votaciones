-- ============================================
-- ADD discord_user_id TO credit_cards TABLE
-- ============================================
-- This makes credit_cards consistent with debit_cards
-- and allows direct access without JOINs

-- 1. Add the column (allows NULL initially)
ALTER TABLE credit_cards 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT;

-- 2. NOTE: Existing rows will have NULL discord_user_id
--    They will be populated when users use their cards
--    Future inserts will include discord_user_id from the start

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_cards_discord_user_id 
ON credit_cards(discord_user_id);

-- 4. Add comment
COMMENT ON COLUMN credit_cards.discord_user_id IS 'Discord user ID for direct access without JOIN';
