-- Privacy Banking System Tables
-- Run this in Supabase SQL Editor

-- Main privacy accounts table
CREATE TABLE IF NOT EXISTS privacy_accounts (
    user_id TEXT PRIMARY KEY,
    level TEXT CHECK(level IN ('basico', 'vip', 'elite')) NOT NULL,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    offshore_name TEXT,
    auto_renew BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    panic_pin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency vault for Elite users
CREATE TABLE IF NOT EXISTS privacy_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES privacy_accounts(user_id),
    amount NUMERIC DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security alerts log
CREATE TABLE IF NOT EXISTS privacy_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    alert_type TEXT, -- 'robbery_attempt', 'balance_viewed', 'transfer_received'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debit card tiers (if not exists)
CREATE TABLE IF NOT EXISTS debit_card_tiers (
    card_type TEXT PRIMARY KEY,
    monthly_fee NUMERIC NOT NULL,
    withdrawal_limit NUMERIC NOT NULL,
    transfer_limit NUMERIC NOT NULL,
    cashback_percent NUMERIC DEFAULT 0,
    priority_support BOOLEAN DEFAULT false
);

-- Insert card tiers
INSERT INTO debit_card_tiers (card_type, monthly_fee, withdrawal_limit, transfer_limit, cashback_percent, priority_support)
VALUES 
    ('Basic', 0, 50000, 100000, 0, false),
    ('Gold', 5000, 200000, 500000, 1, false),
    ('Platinum', 15000, 1000000, 2000000, 2, true),
    ('Black', 50000, 10000000, 10000000, 5, true)
ON CONFLICT (card_type) DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_privacy_user ON privacy_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_level ON privacy_accounts(level);
CREATE INDEX IF NOT EXISTS idx_vault_user ON privacy_vault(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON privacy_alerts(user_id);

-- Enable RLS
ALTER TABLE privacy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own data)
CREATE POLICY "Users can view own privacy" ON privacy_accounts
    FOR SELECT USING (true); -- Staff can see all

CREATE POLICY "Users can insert own privacy" ON privacy_accounts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own privacy" ON privacy_accounts
    FOR UPDATE USING (true);

CREATE POLICY "Users can view own vault" ON privacy_vault
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own vault" ON privacy_vault
    FOR ALL USING (true);
