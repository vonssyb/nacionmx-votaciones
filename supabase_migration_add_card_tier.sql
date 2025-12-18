-- Add card_tier column to debit_cards table
ALTER TABLE debit_cards 
ADD COLUMN IF NOT EXISTS card_tier TEXT DEFAULT 'NMX Débito';

-- Update existing cards to have the default tier
UPDATE debit_cards 
SET card_tier = 'NMX Débito' 
WHERE card_tier IS NULL;
