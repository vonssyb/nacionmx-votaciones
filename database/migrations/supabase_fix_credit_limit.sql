-- FIX: Conflict between 'card_limit' and 'credit_limit' columns
-- The code uses 'card_limit', but the database has 'credit_limit' as NOT NULL.
-- This script fixes it by migrating data and removing the constraint.

DO $$
BEGIN
    -- Check if 'credit_limit' column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_cards' AND column_name = 'credit_limit') THEN
        
        -- Make sure 'card_limit' exists
        ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS card_limit DECIMAL(15,2) DEFAULT 0;

        -- Copy data from credit_limit to card_limit (if present)
        UPDATE credit_cards 
        SET card_limit = credit_limit 
        WHERE credit_limit IS NOT NULL AND (card_limit IS NULL OR card_limit = 0);

        -- Remove NOT NULL constraint from credit_limit so inserts won't fail
        ALTER TABLE credit_cards ALTER COLUMN credit_limit DROP NOT NULL;
        
        -- Optional: Drop the old column entirely to avoid confusion in future
        -- ALTER TABLE credit_cards DROP COLUMN credit_limit;
    END IF;
END $$;

-- Ensure card_limit is numeric
ALTER TABLE credit_cards ALTER COLUMN card_limit TYPE DECIMAL(15,2);
