-- ============================================
-- REMOVE OUTDATED card_type CHECK CONSTRAINT
-- ============================================
-- The constraint only allows 8 old card types but the bot has 13 types
-- This prevents registration of: NMX Platino Elite, NMX Zafiro, etc.

ALTER TABLE credit_cards 
DROP CONSTRAINT IF EXISTS credit_cards_card_type_check;

-- Now credit_cards accepts any card_type value
-- The bot code validates the types, so this is safe
