-- ===================================================================
-- Fase 3, Item #8: Dynamic Card Limits by Role
-- SQL Tables, Functions, and Default Data
-- ===================================================================

-- Table: card_limits
-- Role-based card limit configurations
CREATE TABLE IF NOT EXISTS card_limits (
  role_id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  
  -- Debit card limits
  debit_base_limit NUMERIC DEFAULT 50000,
  debit_max_limit NUMERIC DEFAULT 5000000,
  
  -- Credit card limits (per tier)
  credit_start_limit NUMERIC DEFAULT 15000,
  credit_basica_limit NUMERIC DEFAULT 30000,
  credit_plus_limit NUMERIC DEFAULT 50000,
  credit_plata_limit NUMERIC DEFAULT 100000,
  credit_oro_limit NUMERIC DEFAULT 250000,
  credit_rubi_limit NUMERIC DEFAULT 500000,
  credit_black_limit NUMERIC DEFAULT 1000000,
  credit_diamante_limit NUMERIC DEFAULT 5000000,
  
  -- Business card limits
  business_limit NUMERIC DEFAULT 10000000,
  
  -- Transaction limits
  max_transaction NUMERIC DEFAULT 1000000,
  daily_transaction_limit NUMERIC DEFAULT 5000000,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_limits_role ON card_limits(role_id);

-- Table: user_limit_overrides
-- User-specific limit overrides
CREATE TABLE IF NOT EXISTS user_limit_overrides (
  user_id TEXT PRIMARY KEY,
  
  -- Override specific limits (nullable - only set what's overridden)
  debit_limit NUMERIC,
  credit_start_limit NUMERIC,
  credit_basica_limit NUMERIC,
  credit_plus_limit NUMERIC,
  credit_plata_limit NUMERIC,
  credit_oro_limit NUMERIC,
  credit_rubi_limit NUMERIC,
  credit_black_limit NUMERIC,
  credit_diamante_limit NUMERIC,
  business_limit NUMERIC,
  max_transaction NUMERIC,
  daily_limit NUMERIC,
  
  reason TEXT,
  set_by TEXT, -- Admin Discord ID who set it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_overrides_user ON user_limit_overrides(user_id);

-- Insert default limits (for all users without specific role)
INSERT INTO card_limits (role_id, role_name)
VALUES ('default', 'Default User')
ON CONFLICT (role_id) DO NOTHING;

-- Function: get_user_card_limit
-- Returns the appropriate limit for a user based on overrides and role
CREATE OR REPLACE FUNCTION get_user_card_limit(
  p_user_id TEXT,
  p_card_type TEXT,
  p_tier TEXT DEFAULT NULL,
  p_role_id TEXT DEFAULT 'default'
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit NUMERIC;
  v_column_name TEXT;
BEGIN
  -- Build column name based on card type and tier
  IF p_card_type = 'debit' THEN
    v_column_name := 'debit_limit';
  ELSIF p_card_type = 'business' THEN
    v_column_name := 'business_limit';
  ELSIF p_card_type = 'credit' AND p_tier IS NOT NULL THEN
    -- Convert tier name to column name
    -- "NMX Oro" -> "credit_oro_limit"
    v_column_name := 'credit_' || 
                     LOWER(REGEXP_REPLACE(
                       REGEXP_REPLACE(p_tier, '^NMX ', ''), 
                       ' ', '_'
                     )) || '_limit';
  ELSE
    RAISE EXCEPTION 'Invalid card type or missing tier: % %', p_card_type, p_tier;
  END IF;

  -- Step 1: Check for user override
  EXECUTE format(
    'SELECT %I FROM user_limit_overrides WHERE user_id = $1 AND %I IS NOT NULL',
    v_column_name, v_column_name
  ) INTO v_limit USING p_user_id;
  
  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;

  -- Step 2: Get from role limits
  EXECUTE format(
    'SELECT %I FROM card_limits WHERE role_id = $1',
    v_column_name
  ) INTO v_limit USING p_role_id;
  
  IF v_limit IS NOT NULL THEN
    RETURN v_limit;
  END IF;

  -- Step 3: Fallback to default role
  IF p_role_id != 'default' THEN
    EXECUTE format(
      'SELECT %I FROM card_limits WHERE role_id = $1',
      v_column_name
    ) INTO v_limit USING 'default';
  END IF;

  -- Return limit or hardcoded fallback
  RETURN COALESCE(v_limit, 50000);
END;
$$;

-- Function: set_role_limits
-- Admin function to update limits for a role
CREATE OR REPLACE FUNCTION set_role_limits(
  p_role_id TEXT,
  p_role_name TEXT,
  p_limits JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO card_limits (role_id, role_name, updated_at)
  VALUES (p_role_id, p_role_name, NOW())
  ON CONFLICT (role_id) 
  DO UPDATE SET
    role_name = EXCLUDED.role_name,
    debit_base_limit = COALESCE((p_limits->>'debit_base_limit')::NUMERIC, card_limits.debit_base_limit),
    debit_max_limit = COALESCE((p_limits->>'debit_max_limit')::NUMERIC, card_limits.debit_max_limit),
    credit_start_limit = COALESCE((p_limits->>'credit_start_limit')::NUMERIC, card_limits.credit_start_limit),
    credit_basica_limit = COALESCE((p_limits->>'credit_basica_limit')::NUMERIC, card_limits.credit_basica_limit),
    credit_plus_limit = COALESCE((p_limits->>'credit_plus_limit')::NUMERIC, card_limits.credit_plus_limit),
    credit_plata_limit = COALESCE((p_limits->>'credit_plata_limit')::NUMERIC, card_limits.credit_plata_limit),
    credit_oro_limit = COALESCE((p_limits->>'credit_oro_limit')::NUMERIC, card_limits.credit_oro_limit),
    credit_rubi_limit = COALESCE((p_limits->>'credit_rubi_limit')::NUMERIC, card_limits.credit_rubi_limit),
    credit_black_limit = COALESCE((p_limits->>'credit_black_limit')::NUMERIC, card_limits.credit_black_limit),
    credit_diamante_limit = COALESCE((p_limits->>'credit_diamante_limit')::NUMERIC, card_limits.credit_diamante_limit),
    business_limit = COALESCE((p_limits->>'business_limit')::NUMERIC, card_limits.business_limit),
    max_transaction = COALESCE((p_limits->>'max_transaction')::NUMERIC, card_limits.max_transaction),
    daily_transaction_limit = COALESCE((p_limits->>'daily_transaction_limit')::NUMERIC, card_limits.daily_transaction_limit),
    updated_at = NOW();
    
  RETURN TRUE;
END;
$$;

-- Function: set_user_override
-- Admin function to set user-specific overrides
CREATE OR REPLACE FUNCTION set_user_override(
  p_user_id TEXT,
  p_limits JSONB,
  p_reason TEXT,
  p_set_by TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_limit_overrides (user_id, reason, set_by, updated_at)
  VALUES (p_user_id, p_reason, p_set_by, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    debit_limit = COALESCE((p_limits->>'debit_limit')::NUMERIC, user_limit_overrides.debit_limit),
    credit_start_limit = COALESCE((p_limits->>'credit_start_limit')::NUMERIC, user_limit_overrides.credit_start_limit),
    credit_oro_limit = COALESCE((p_limits->>'credit_oro_limit')::NUMERIC, user_limit_overrides.credit_oro_limit),
    business_limit = COALESCE((p_limits->>'business_limit')::NUMERIC, user_limit_overrides.business_limit),
    max_transaction = COALESCE((p_limits->>'max_transaction')::NUMERIC, user_limit_overrides.max_transaction),
    daily_limit = COALESCE((p_limits->>'daily_limit')::NUMERIC, user_limit_overrides.daily_limit),
    reason = p_reason,
    set_by = p_set_by,
    updated_at = NOW();
    
  RETURN TRUE;
END;
$$;

-- Function: remove_user_override
-- Remove all overrides for a user
CREATE OR REPLACE FUNCTION remove_user_override(p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM user_limit_overrides WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;

-- Function: get_role_limits
-- Get all limits for a specific role
CREATE OR REPLACE FUNCTION get_role_limits(p_role_id TEXT)
RETURNS card_limits
LANGUAGE plpgsql
AS $$
DECLARE
  v_limits card_limits;
BEGIN
  SELECT * INTO v_limits
  FROM card_limits
  WHERE role_id = p_role_id;
  
  IF NOT FOUND THEN
    SELECT * INTO v_limits
    FROM card_limits
    WHERE role_id = 'default';
  END IF;
  
  RETURN v_limits;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON card_limits TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_limit_overrides TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_card_limit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_role_limits TO service_role;
GRANT EXECUTE ON FUNCTION set_user_override TO service_role;
GRANT EXECUTE ON FUNCTION remove_user_override TO service_role;
GRANT EXECUTE ON FUNCTION get_role_limits TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Dynamic Card Limits system created successfully!';
  RAISE NOTICE 'Tables: card_limits, user_limit_overrides';
  RAISE NOTICE 'Functions: get_user_card_limit, set_role_limits, set_user_override, remove_user_override, get_role_limits';
  RAISE NOTICE 'Default limits inserted for role_id: default';
END $$;
