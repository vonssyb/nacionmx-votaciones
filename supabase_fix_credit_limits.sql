-- FIX CREDIT CARD LIMITS
-- This script updates NULL credit_limit values based on card_type and ensures the column is valid.

-- 0. SYNC IDs (Crucial Step: Fix fragmented user IDs)
-- Checks if one column is empty and fills it with the other.
UPDATE credit_cards SET discord_id = discord_user_id WHERE discord_id IS NULL AND discord_user_id IS NOT NULL;
UPDATE credit_cards SET discord_user_id = discord_id WHERE discord_user_id IS NULL AND discord_id IS NOT NULL;

-- 1. Update Personal Credit Cards
UPDATE credit_cards SET card_limit = 15000 WHERE card_type = 'NMX Start' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 30000 WHERE card_type = 'NMX Básica' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 50000 WHERE card_type = 'NMX Plus' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 100000 WHERE card_type = 'NMX Plata' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 250000 WHERE card_type = 'NMX Oro' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 500000 WHERE card_type = 'NMX Rubí' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 1000000 WHERE card_type = 'NMX Black' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 2000000 WHERE card_type = 'NMX Diamante' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 5000000 WHERE card_type = 'NMX Zafiro' AND card_limit IS NULL;
UPDATE credit_cards SET card_limit = 10000000 WHERE card_type = 'NMX Platino Elite' AND card_limit IS NULL;

-- 2. Update Business Credit Cards (if any)
UPDATE business_credit_cards SET credit_limit = 50000 WHERE card_type = 'NMX Business Start' AND credit_limit IS NULL;
UPDATE business_credit_cards SET credit_limit = 100000 WHERE card_type = 'NMX Business Gold' AND credit_limit IS NULL;
UPDATE business_credit_cards SET credit_limit = 200000 WHERE card_type = 'NMX Business Platinum' AND credit_limit IS NULL;
UPDATE business_credit_cards SET credit_limit = 500000 WHERE card_type = 'NMX Business Elite' AND credit_limit IS NULL;
UPDATE business_credit_cards SET credit_limit = 1000000 WHERE card_type = 'NMX Business Infinity' AND credit_limit IS NULL;
-- Add other business tiers if necessary

-- 3. Set Default for any remaining NULLs (Fallback)
UPDATE credit_cards SET card_limit = 0 WHERE card_limit IS NULL;
UPDATE business_credit_cards SET credit_limit = 0 WHERE credit_limit IS NULL;

-- 4. Alter Table to Enforce NOT NULL (Optional, strictly if you want to prevent future NULLs)
-- ALTER TABLE credit_cards ALTER COLUMN card_limit SET NOT NULL;
-- ALTER TABLE credit_cards ALTER COLUMN card_limit SET DEFAULT 0;
