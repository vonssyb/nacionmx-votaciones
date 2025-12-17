-- Stock Trading System Schema
-- Creates tables for user portfolios and transaction history

-- Table: stock_portfolios
-- Stores user's stock holdings
CREATE TABLE IF NOT EXISTS stock_portfolios (
  id BIGSERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  stock_symbol TEXT NOT NULL,
  shares DECIMAL(18, 4) NOT NULL DEFAULT 0,
  avg_buy_price DECIMAL(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_stock UNIQUE(discord_user_id, stock_symbol),
  CONSTRAINT positive_shares CHECK (shares >= 0)
);

-- Table: stock_transactions
-- Records all buy/sell transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  stock_symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  shares DECIMAL(18, 4) NOT NULL,
  price_per_share DECIMAL(18, 2) NOT NULL,
  total_amount DECIMAL(18, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON stock_portfolios(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON stock_transactions(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON stock_transactions(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_portfolio_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER portfolio_updated_at
  BEFORE UPDATE ON stock_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_portfolio_timestamp();

-- Row Level Security (RLS)
ALTER TABLE stock_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all operations (bot has service role)
CREATE POLICY "Enable all for service role" ON stock_portfolios FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON stock_transactions FOR ALL USING (true);
