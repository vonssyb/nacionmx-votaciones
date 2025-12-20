-- ===================================================================
-- New Economy Features: Staking, Funds, Slots, Roulette
-- 4 Complete Systems
-- ===================================================================

-- =====================================================================
-- 1. CRYPTO STAKING SYSTEM
-- =====================================================================

-- Table: crypto_stakes
CREATE TABLE IF NOT EXISTS crypto_stakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  crypto_symbol TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  apy NUMERIC NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  locked_days INTEGER NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'withdrawn'
  earnings NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakes_user ON crypto_stakes(user_id);
CREATE INDEX IF NOT EXISTS idx_stakes_status ON crypto_stakes(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_stakes_end ON crypto_stakes(end_date) WHERE status = 'active';

-- Function: calculate_stake_earnings
CREATE OR REPLACE FUNCTION calculate_stake_earnings(p_stake_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_stake crypto_stakes;
  v_days_elapsed INTEGER;
  v_earnings NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM crypto_stakes WHERE id = p_stake_id;
  
  IF v_stake IS NULL THEN
    RETURN 0;
  END IF;
  
  v_days_elapsed := EXTRACT(DAY FROM NOW() - v_stake.start_date);
  v_earnings := (v_stake.amount * v_stake.apy / 100 / 365) * v_days_elapsed;
  
  RETURN v_earnings;
END;
$$;

-- =====================================================================
-- 2. INVESTMENT FUNDS SYSTEM
-- =====================================================================

-- Table: investment_funds
CREATE TABLE IF NOT EXISTS investment_funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  risk_level TEXT NOT NULL, -- 'conservative', 'balanced', 'aggressive'
  apy NUMERIC NOT NULL,
  description TEXT,
  min_investment NUMERIC DEFAULT 1000,
  active BOOLEAN DEFAULT true
);

-- Table: fund_investments
CREATE TABLE IF NOT EXISTS fund_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  fund_id UUID REFERENCES investment_funds(id),
  amount NUMERIC NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  current_value NUMERIC NOT NULL,
  earnings NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_inv_user ON fund_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_fund_inv_fund ON fund_investments(fund_id);

-- Insert default funds
INSERT INTO investment_funds (name, risk_level, apy, description, min_investment)
VALUES
  ('Fondo Conservador', 'conservative', 3.0, 'Bajo riesgo, retornos estables', 1000),
  ('Fondo Balanceado', 'balanced', 6.0, 'Riesgo moderado, buen balance', 5000),
  ('Fondo Agresivo', 'aggressive', 12.0, 'Alto riesgo, alto potencial', 10000)
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 3. SLOT MACHINE SYSTEM
-- =====================================================================

-- Table: slot_spins
CREATE TABLE IF NOT EXISTS slot_spins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  bet_amount NUMERIC NOT NULL,
  result JSONB NOT NULL, -- {reel1, reel2, reel3}
  payout NUMERIC DEFAULT 0,
  win BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slots_user ON slot_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_slots_date ON slot_spins(created_at DESC);

-- Table: slot_jackpot
CREATE TABLE IF NOT EXISTS slot_jackpot (
  id INTEGER PRIMARY KEY DEFAULT 1,
  amount NUMERIC DEFAULT 10000,
  last_winner TEXT,
  last_won_at TIMESTAMPTZ,
  CHECK (id = 1) -- Only one row
);

INSERT INTO slot_jackpot (amount) VALUES (10000) ON CONFLICT DO NOTHING;

-- =====================================================================
-- 4. ROULETTE SYSTEM (Improved)
-- =====================================================================

-- Table: roulette_games
CREATE TABLE IF NOT EXISTS roulette_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_number INTEGER NOT NULL,
  winning_number INTEGER NOT NULL,
  winning_color TEXT NOT NULL,
  total_pot NUMERIC DEFAULT 0,
  total_players INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: roulette_bets
CREATE TABLE IF NOT EXISTS roulette_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES roulette_games(id),
  user_id TEXT NOT NULL,
  bet_type TEXT NOT NULL, -- 'number', 'color', 'odd', 'even'
  bet_value TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payout NUMERIC DEFAULT 0,
  won BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roulette_bets_game ON roulette_bets(game_id);
CREATE INDEX IF NOT EXISTS idx_roulette_bets_user ON roulette_bets(user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON crypto_stakes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON investment_funds TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON fund_investments TO authenticated, service_role;
GRANT SELECT, INSERT ON slot_spins TO authenticated, service_role;
GRANT SELECT, UPDATE ON slot_jackpot TO authenticated, service_role;
GRANT SELECT, INSERT ON roulette_games TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON roulette_bets TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION calculate_stake_earnings TO authenticated, service_role;

DO $$
BEGIN
  RAISE NOTICE '4 New Economy Systems Created!';
  RAISE NOTICE '1. Crypto Staking (passive income)';
  RAISE NOTICE '2. Investment Funds (3 risk levels)';
  RAISE NOTICE '3. Slot Machine (casino game)';
  RAISE NOTICE '4. Roulette (improved betting)';
END $$;
