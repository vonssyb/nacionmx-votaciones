-- Enhanced Audit System - Transaction Logs
-- This table logs ALL economic transactions with full context for security and rollback

CREATE TABLE IF NOT EXISTS transaction_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'transfer', 'purchase', 'sanction', 'license', 'admin_add', 'admin_remove', 'store_purchase', 'card_payment', etc
  amount NUMERIC(15,2),
  currency_type TEXT DEFAULT 'cash', -- 'cash', 'bank', 'credit'
  
  -- Context
  target_user_id TEXT, -- For transfers, sanctions, etc
  item_description TEXT, -- What was purchased/transferred
  reason TEXT, -- Administrative reason or transaction purpose
  metadata JSONB, -- Full context (balances before/after, command options, etc)
  
  -- Tracking
  created_by TEXT NOT NULL, -- Discord user ID who initiated
  created_by_tag TEXT, -- Discord user tag for readability
  command_name TEXT, -- Which command triggered this
  interaction_id TEXT, -- Discord interaction ID for traceability
  
  -- Rollback capability
  can_rollback BOOLEAN DEFAULT TRUE,
  rolled_back BOOLEAN DEFAULT FALSE,
  rollback_transaction_id INTEGER REFERENCES transaction_logs(id), -- If this was a rollback, reference original
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user ON transaction_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_type ON transaction_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_created_by ON transaction_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_date ON transaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_rollback ON transaction_logs(rolled_back) WHERE can_rollback = TRUE;

-- View for easy querying of recent suspicious transactions
CREATE OR REPLACE VIEW suspicious_transactions AS
SELECT 
  tl.*,
  CASE 
    WHEN amount > 100000 THEN 'Large Amount'
    WHEN transaction_type = 'transfer' AND amount > 50000 THEN 'Large Transfer'
    WHEN created_at > NOW() - INTERVAL '1 hour' AND 
         (SELECT COUNT(*) FROM transaction_logs tl2 
          WHERE tl2.user_id = tl.user_id 
          AND tl2.created_at > NOW() - INTERVAL '1 hour') > 10 THEN 'High Frequency'
    ELSE 'Unknown'
  END as suspicion_reason
FROM transaction_logs tl
WHERE 
  (amount > 100000 OR 
   (transaction_type = 'transfer' AND amount > 50000) OR
   (created_at > NOW() - INTERVAL '1 hour' AND 
    (SELECT COUNT(*) FROM transaction_logs tl2 
     WHERE tl2.user_id = tl.user_id 
     AND tl2.created_at > NOW() - INTERVAL '1 hour') > 10))
  AND rolled_back = FALSE
ORDER BY created_at DESC;

COMMENT ON TABLE transaction_logs IS 'Comprehensive logging of all economic transactions for audit and rollback';
COMMENT ON VIEW suspicious_transactions IS 'Auto-detection of potentially fraudulent transactions';
