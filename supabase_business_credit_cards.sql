-- Business Credit Cards Table
-- Required for company credit payment method

CREATE TABLE IF NOT EXISTS business_credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    card_number VARCHAR(16) UNIQUE DEFAULT LEFT(MD5(RANDOM()::TEXT), 16),
    credit_limit BIGINT DEFAULT 5000000, -- $5M default
    current_balance BIGINT DEFAULT 0,
    apr DECIMAL(5,2) DEFAULT 15.99,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast company lookups
CREATE INDEX IF NOT EXISTS idx_business_credit_company ON business_credit_cards(company_id);

-- RLS Policies
ALTER TABLE business_credit_cards ENABLE ROW LEVEL SECURITY;

-- Public can read (bot needs access)
CREATE POLICY "Allow public read" ON business_credit_cards FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role all" ON business_credit_cards FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE business_credit_cards IS 'Business credit cards for company payments';
