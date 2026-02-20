-- Privacy System Enhancements
-- Add these columns to privacy_accounts table

ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS cashback_earned NUMERIC DEFAULT 0;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS privacy_score INTEGER DEFAULT 0;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT true;
ALTER TABLE privacy_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Drop tables if they exist (to avoid column conflicts)
DROP TABLE IF EXISTS privacy_alerts CASCADE;
DROP TABLE IF EXISTS burner_wallets CASCADE;
DROP TABLE IF EXISTS scheduled_transfers CASCADE;
DROP TABLE IF EXISTS privacy_family CASCADE;
DROP TABLE IF EXISTS privacy_referrals CASCADE;

-- Alerts table
CREATE TABLE privacy_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'robbery_attempt', 'balance_viewed', 'transfer_received', 'renewal_reminder'
    message TEXT,
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Burner wallets
CREATE TABLE burner_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    wallet_id TEXT UNIQUE NOT NULL,
    balance NUMERIC DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programmed transfers
CREATE TABLE scheduled_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'a
    next_execution TIMESTAMPTZ NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family sharing
CREATE TABLE privacy_family (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, member_id)
);

-- Referrals
CREATE TABLE privacy_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT NOT NULL,
    referee_id TEXT NOT NULL,
    reward_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_user_read ON privacy_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_burner_expires ON burner_wallets(expires_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_transfers(next_execution) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_family_owner ON privacy_family(owner_id);

-- Function to calculate privacy score
CREATE OR REPLACE FUNCTION calculate_privacy_score(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    account RECORD;
    days_active INTEGER;
BEGIN
    SELECT * INTO account FROM privacy_accounts WHERE user_id = p_user_id;
    
    IF account IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Base score by level
    CASE account.level
        WHEN 'basico' THEN score := score + 20;
        WHEN 'vip' THEN score := score + 50;
        WHEN 'elite' THEN score := score + 80;
    END CASE;
    
    -- Time subscribed (max 15 points)
    days_active := EXTRACT(DAY FROM NOW() - account.activated_at);
    score := score + LEAST(days_active, 15);
    
    -- Vault usage (5 points)
    IF EXISTS (SELECT 1 FROM privacy_vault WHERE user_id = p_user_id AND amount > 0) THEN
        score := score + 5;
    END IF;
    
    -- Verified (10 points)
    IF account.verified THEN
        score := score + 10;
    END IF;
    
    -- Auto-renew (5 points)
    IF account.auto_renew THEN
        score := score + 5;
    END IF;
    
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;
