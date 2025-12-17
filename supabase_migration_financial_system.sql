-- =====================================================
-- MIGRATION: Financial Balance System
-- Features: Debit Cards, Dynamic Taxes, Delayed Transfers
-- =====================================================

-- 1. DEBIT CARDS TABLE
CREATE TABLE IF NOT EXISTS debit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    card_number TEXT UNIQUE NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0 CHECK (balance >= 0),
    card_type TEXT DEFAULT 'NMX Débito',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_debit_cards_discord ON debit_cards(discord_user_id);
CREATE INDEX idx_debit_cards_citizen ON debit_cards(citizen_id);

-- 2. TAX CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS tax_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_type TEXT NOT NULL UNIQUE, -- 'weekly', 'transaction', 'income'
    rate DECIMAL(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100),
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tax rates
INSERT INTO tax_config (tax_type, rate, description, active) VALUES
('weekly', 10.00, 'Impuesto semanal sobre balance total', true),
('transaction', 5.00, 'Impuesto sobre transacciones >$10,000', true),
('income', 15.00, 'Impuesto sobre ingresos grandes', false)
ON CONFLICT (tax_type) DO NOTHING;

-- 3. TAX PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS tax_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    tax_type TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    base_amount DECIMAL(15,2) NOT NULL, -- Amount taxed was calculated from
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    due_date TIMESTAMP NOT NULL,
    paid_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tax_payments_user ON tax_payments(discord_user_id);
CREATE INDEX idx_tax_payments_status ON tax_payments(status);
CREATE INDEX idx_tax_payments_due ON tax_payments(due_date);

-- 4. PENDING TRANSFERS TABLE (for delayed transactions)
CREATE TABLE IF NOT EXISTS pending_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id TEXT NOT NULL,
    to_user_id TEXT, -- NULL for deposits
    amount DECIMAL(15,2) NOT NULL,
    transfer_type TEXT NOT NULL CHECK (transfer_type IN ('cash_to_debit', 'debit_to_debit')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    scheduled_completion TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pending_transfers_from ON pending_transfers(from_user_id);
CREATE INDEX idx_pending_transfers_scheduled ON pending_transfers(scheduled_completion);
CREATE INDEX idx_pending_transfers_status ON pending_transfers(status, scheduled_completion);

-- 5. DEBIT TRANSACTIONS LOG (for audit trail)
CREATE TABLE IF NOT EXISTS debit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debit_card_id UUID REFERENCES debit_cards(id) ON DELETE CASCADE,
    discord_user_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw', 'transfer_in', 'transfer_out', 'tax', 'fee')),
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    related_user_id TEXT, -- For transfers
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_debit_transactions_user ON debit_transactions(discord_user_id);
CREATE INDEX idx_debit_transactions_card ON debit_transactions(debit_card_id);
CREATE INDEX idx_debit_transactions_type ON debit_transactions(transaction_type);

-- 6. FUNCTIONS

-- Auto-generate card numbers
CREATE OR REPLACE FUNCTION generate_card_number()
RETURNS TEXT AS $$
BEGIN
    RETURN '4279' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER debit_cards_updated_at
BEFORE UPDATE ON debit_cards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 7. ROW LEVEL SECURITY

ALTER TABLE debit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE debit_transactions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY service_role_all_debit_cards ON debit_cards FOR ALL USING (true);
CREATE POLICY service_role_all_tax_payments ON tax_payments FOR ALL USING (true);
CREATE POLICY service_role_all_pending_transfers ON pending_transfers FOR ALL USING (true);
CREATE POLICY service_role_all_debit_transactions ON debit_transactions FOR ALL USING (true);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
