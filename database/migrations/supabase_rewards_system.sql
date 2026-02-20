-- ===================================================================
-- Fase 4, Item #12: Rewards/Cashback Points System
-- SQL Tables for points management
-- ===================================================================

-- Table: user_points
-- Track user points balance
CREATE TABLE IF NOT EXISTS user_points (
  user_id TEXT PRIMARY KEY,
  points_balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  lifetime_redeemed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_balance ON user_points(points_balance DESC);

-- Table: points_transactions
-- Log all points movements
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'earn', 'redeem', 'bonus', 'expire'
  source TEXT, -- 'transaction', 'purchase', 'referral', 'manual'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_tx_user ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_tx_date ON points_transactions(created_at DESC);

-- Table: rewards_catalog
-- Available rewards to redeem
CREATE TABLE IF NOT EXISTS rewards_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  cash_value NUMERIC,
  item_type TEXT, -- 'cash', 'perk', 'item'
  active BOOLEAN DEFAULT true,
  stock INTEGER, -- NULL = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards_catalog(active) WHERE active = true;

-- Function: award_points
-- Give points to user
CREATE OR REPLACE FUNCTION award_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT,
  p_source TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create user points record if doesn't exist
  INSERT INTO user_points (user_id, points_balance, lifetime_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    points_balance = user_points.points_balance + p_amount,
    lifetime_earned = user_points.lifetime_earned + p_amount,
    updated_at = NOW();

  -- Log transaction
  INSERT INTO points_transactions (user_id, amount, type, source, metadata)
  VALUES (p_user_id, p_amount, p_type, p_source, p_metadata);

  RETURN TRUE;
END;
$$;

-- Function: redeem_points
-- Redeem points (deduct from balance)
CREATE OR REPLACE FUNCTION redeem_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reward_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT points_balance INTO v_current_balance
  FROM user_points
  WHERE user_id = p_user_id;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  -- Deduct points
  UPDATE user_points
  SET 
    points_balance = points_balance - p_amount,
    lifetime_redeemed = lifetime_redeemed + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log redemption
  INSERT INTO points_transactions (user_id, amount, type, source, metadata)
  VALUES (
    p_user_id,
    -p_amount,
    'redeem',
    'redemption',
    jsonb_build_object('reward_id', p_reward_id)
  );

  RETURN TRUE;
END;
$$;

-- Function: calculate_transaction_points
-- Calculate points for a transaction amount
CREATE OR REPLACE FUNCTION calculate_transaction_points(
  p_amount NUMERIC,
  p_card_type TEXT DEFAULT 'debit'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_points INTEGER;
  v_multiplier NUMERIC;
BEGIN
  -- Credit cards earn 2x points
  IF p_card_type LIKE '%credit%' THEN
    v_multiplier := 2.0;
  ELSE
    v_multiplier := 1.0;
  END IF;

  -- 1 point per $100 spent (adjusted by multiplier)
  v_points := FLOOR((p_amount / 100) * v_multiplier);

  RETURN GREATEST(v_points, 0);
END;
$$;

-- Function: get_user_points_summary
-- Get complete points summary for user
CREATE OR REPLACE FUNCTION get_user_points_summary(p_user_id TEXT)
RETURNS TABLE (
  points_balance INTEGER,
  lifetime_earned INTEGER,
  lifetime_redeemed INTEGER,
  recent_transactions JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.points_balance,
    up.lifetime_earned,
    up.lifetime_redeemed,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'amount', pt.amount,
          'type', pt.type,
          'source', pt.source,
          'created_at', pt.created_at
        )
        ORDER BY pt.created_at DESC
      )
      FROM points_transactions pt
      WHERE pt.user_id = p_user_id
      LIMIT 10
    ) as recent_transactions
  FROM user_points up
  WHERE up.user_id = p_user_id;
END;
$$;

-- Insert default rewards
INSERT INTO rewards_catalog (name, description, points_cost, cash_value, item_type)
VALUES 
  ('Cash $1', 'Redeem 100 points for $1 cash', 100, 1, 'cash'),
  ('Cash $5', 'Redeem 500 points for $5 cash', 500, 5, 'cash'),
  ('Cash $10', 'Redeem 1000 points for $10 cash', 1000, 10, 'cash'),
  ('Cash $50', 'Redeem 5000 points for $50 cash', 5000, 50, 'cash'),
  ('Bonus 10% Interest', 'Get 10% extra interest this month', 2000, NULL, 'perk'),
  ('Fee Waiver', 'Waive all fees for 1 month', 1500, NULL, 'perk')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_points TO authenticated, service_role;
GRANT SELECT, INSERT ON points_transactions TO authenticated, service_role;
GRANT SELECT ON rewards_catalog TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION award_points TO service_role;
GRANT EXECUTE ON FUNCTION redeem_points TO service_role;
GRANT EXECUTE ON FUNCTION calculate_transaction_points TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_points_summary TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Rewards/Cashback system created successfully!';
  RAISE NOTICE 'Tables: user_points, points_transactions, rewards_catalog';
  RAISE NOTICE 'Functions: award_points, redeem_points, calculate_transaction_points, get_user_points_summary';
  RAISE NOTICE 'Default rewards inserted';
END $$;
