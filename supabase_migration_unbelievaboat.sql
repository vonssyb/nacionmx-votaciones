-- Migration: UnbelievaBoat Economy Integration

-- 1. Create Transaction Logs Table (Audit Trail)
CREATE TABLE IF NOT EXISTS transaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    discord_user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('PAYMENT', 'INTEREST', 'PENALTY', 'CHARGE', 'ADJUSTMENT')),
    status VARCHAR(20) CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Stores UnbelievaBoat response or error details
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update Credit Cards for Scheduling and Streaks
ALTER TABLE credit_cards 
ADD COLUMN IF NOT EXISTS next_payment_due TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consecutive_missed_payments INT DEFAULT 0;

-- 3. RLS Policies for Transaction Logs
ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;

-- Allow Staff to view all logs
CREATE POLICY "Staff can view all transaction logs" 
ON transaction_logs FOR SELECT 
USING (
    auth.role() = 'authenticated' AND (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'staff', 'moderator')
        )
    )
);

-- Allow Users to view their own logs (linked via card or discord_id if we had that link in auth, 
-- but for now mainly staff tool, or backend bot)
-- Bot Service Role bypasses RLS anyway.
