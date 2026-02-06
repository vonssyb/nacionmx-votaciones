-- Migration: Add Stock Market System
-- Purpose: Enable stock trading for companies

-- 1. Add Stock Columns to Companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS ticker VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS stock_price NUMERIC(15, 2) DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS volatility NUMERIC(5, 4) DEFAULT 0.05, -- 5% fluctuation
ADD COLUMN IF NOT EXISTS total_shares BIGINT DEFAULT 1000000,
ADD COLUMN IF NOT EXISTS market_cap NUMERIC(20, 2) GENERATED ALWAYS AS (stock_price * total_shares) STORED;

-- 2. Create Portfolio Table (User Holdings)
CREATE TABLE IF NOT EXISTS stock_portfolio (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    guild_id VARCHAR(50) NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    quantity BIGINT NOT NULL DEFAULT 0,
    average_buy_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, company_id)
);

-- 3. Create Market History Table (For Graphs)
CREATE TABLE IF NOT EXISTS stock_market_history (
    id SERIAL PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    price NUMERIC(15, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_stock_history_company ON stock_market_history(company_id, recorded_at);
