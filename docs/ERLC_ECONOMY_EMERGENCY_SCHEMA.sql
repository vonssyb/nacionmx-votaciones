-- =====================================================
-- ERLC ECONOMY & EMERGENCY SYSTEM - DATABASE SCHEMA
-- =====================================================

-- Table 1: ERLC Transactions (Payments & Charges)
CREATE TABLE IF NOT EXISTS erlc_transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_type TEXT NOT NULL, -- 'payment' or 'charge'
    sender_roblox TEXT NOT NULL,
    sender_discord_id TEXT,
    receiver_roblox TEXT NOT NULL,
    receiver_discord_id TEXT,
    amount INTEGER NOT NULL,
    concept TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_erlc_transactions_sender ON erlc_transactions(sender_discord_id);
CREATE INDEX IF NOT EXISTS idx_erlc_transactions_receiver ON erlc_transactions(receiver_discord_id);
CREATE INDEX IF NOT EXISTS idx_erlc_transactions_timestamp ON erlc_transactions(timestamp DESC);

-- =====================================================

-- Table 2: Payment Requests (Cobros)
CREATE TABLE IF NOT EXISTS payment_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_roblox TEXT NOT NULL,
    requester_discord_id TEXT,
    debtor_roblox TEXT NOT NULL,
    debtor_discord_id TEXT,
    amount INTEGER NOT NULL,
    concept TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    message_id TEXT, -- Discord message ID for the embed
    channel_id TEXT, -- Discord channel ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    resolved_at TIMESTAMPTZ
);

-- Index for active requests
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_requests_debtor ON payment_requests(debtor_discord_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires ON payment_requests(expires_at) WHERE status = 'pending';

-- =====================================================

-- Table 3: Emergency Calls (911)
CREATE TABLE IF NOT EXISTS emergency_calls (
    id BIGSERIAL PRIMARY KEY,
    caller_roblox TEXT NOT NULL,
    caller_discord_id TEXT,
    location TEXT NOT NULL,
    emergency_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'responding', 'resolved'
    responder_discord_id TEXT,
    responder_name TEXT,
    message_id TEXT, -- Discord message ID for the embed
    channel_id TEXT, -- Discord channel ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- Index for active emergencies
CREATE INDEX IF NOT EXISTS idx_emergency_calls_status ON emergency_calls(status);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_timestamp ON emergency_calls(created_at DESC);

-- =====================================================

COMMENT ON TABLE erlc_transactions IS 'Registro de todas las transacciones ERLC (pagos y cobros)';
COMMENT ON TABLE payment_requests IS 'Solicitudes de cobro activas con confirmación';
COMMENT ON TABLE emergency_calls IS 'Llamadas de emergencia 911 desde ERLC';
