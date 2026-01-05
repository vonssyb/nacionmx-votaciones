-- CK Registry Table
-- Stores Character Kill records for audit trail

CREATE TABLE IF NOT EXISTS public.ck_registry (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  
  -- Details
  reason TEXT NOT NULL,
  evidencia_url TEXT,
  
  -- What was removed
  previous_cash NUMERIC(15,2) DEFAULT 0,
  previous_bank NUMERIC(15,2) DEFAULT 0,
  roles_removed TEXT[], -- Array of role names
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_ck_registry_user ON public.ck_registry(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ck_registry_date ON public.ck_registry(created_at DESC);

COMMENT ON TABLE public.ck_registry IS 'Registry of Character Kill actions for audit purposes';
