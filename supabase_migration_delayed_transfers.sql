CREATE TABLE IF NOT EXISTS pending_transfers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id TEXT NOT NULL,          -- Discord ID of sender
    receiver_id TEXT NOT NULL,        -- Discord ID of receiver
    amount NUMERIC(12, 2) NOT NULL,   -- Amount to transfer
    reason TEXT,                      -- Concept/Reason
    release_date TIMESTAMP WITH TIME ZONE NOT NULL, -- When funds are available
    status TEXT DEFAULT 'PENDING',    -- PENDING, COMPLETED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster cron lookup
CREATE INDEX IF NOT EXISTS idx_pending_transfers_status_date ON pending_transfers (status, release_date);
