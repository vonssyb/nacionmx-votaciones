-- Enhanced Audit System - Transaction Logs
-- This table logs ALL economic transactions with full context for security and rollback

-- Drop existing objects if they exist
DROP VIEW IF EXISTS public.suspicious_transactions CASCADE;
DROP TABLE IF EXISTS public.transaction_logs CASCADE;

-- Create transaction logs table
CREATE TABLE public.transaction_logs (
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
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user ON public.transaction_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_type ON public.transaction_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_created_by ON public.transaction_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_date ON public.transaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_rollback ON public.transaction_logs(rolled_back) WHERE can_rollback = TRUE;

-- View for easy querying of recent suspicious transactions
CREATE OR REPLACE VIEW public.suspicious_transactions AS
SELECT 
  id,
  guild_id,
  user_id,
  transaction_type,
  amount,
  currency_type,
  target_user_id,
  item_description,
  reason,
  metadata,
  created_by,
  created_by_tag,
  command_name,
  interaction_id,
  can_rollback,
  rolled_back,
  rollback_transaction_id,
  created_at,
  CASE 
    WHEN amount > 100000 THEN 'Large Amount'
    WHEN transaction_type = 'transfer' AND amount > 50000 THEN 'Large Transfer'
    WHEN created_at > NOW() - INTERVAL '1 hour' AND 
         (SELECT COUNT(*) FROM public.transaction_logs tl2 
          WHERE tl2.user_id = transaction_logs.user_id 
          AND tl2.created_at > NOW() - INTERVAL '1 hour') > 10 THEN 'High Frequency'
    ELSE 'Unknown'
  END as suspicion_reason
FROM public.transaction_logs
WHERE 
  (amount > 100000 OR 
   (transaction_type = 'transfer' AND amount > 50000) OR
   (created_at > NOW() - INTERVAL '1 hour' AND 
    (SELECT COUNT(*) FROM public.transaction_logs tl2 
     WHERE tl2.user_id = transaction_logs.user_id 
     AND tl2.created_at > NOW() - INTERVAL '1 hour') > 10))
  AND rolled_back = FALSE;

COMMENT ON TABLE public.transaction_logs IS 'Comprehensive logging of all economic transactions for audit and rollback';
COMMENT ON VIEW public.suspicious_transactions IS 'Auto-detection of potentially fraudulent transactions';
