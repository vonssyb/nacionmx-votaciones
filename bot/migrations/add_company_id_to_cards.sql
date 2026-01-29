
-- Add company_id to credit_cards table
ALTER TABLE credit_cards
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_credit_cards_company_id ON credit_cards(company_id);
