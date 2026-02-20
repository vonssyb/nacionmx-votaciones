-- ============================================
-- CREATE giro_transfers TABLE
-- ============================================
-- Table for postal money transfers (giros postales)

CREATE TABLE IF NOT EXISTS giro_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    reason TEXT,
    release_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_giro_transfers_receiver ON giro_transfers(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_giro_transfers_release_date ON giro_transfers(release_date) WHERE status = 'pending';

COMMENT ON TABLE giro_transfers IS 'Postal money transfers with 24h delay';
