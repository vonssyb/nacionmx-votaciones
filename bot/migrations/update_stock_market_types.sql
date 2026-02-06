-- Migration: Enhance Stock Market distinction
-- Add company_type to distinguish 'user' (real) vs 'system' (fictional) companies
-- Add last_balance to track financial performance for stock valuation

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_type VARCHAR(20) DEFAULT 'user', -- 'user', 'system'
ADD COLUMN IF NOT EXISTS last_balance NUMERIC(20, 2) DEFAULT 0;

-- Optional: Update existing well-known system companies if any (by owner_id or name)
-- UPDATE companies SET company_type = 'system' WHERE owner_id IS NULL OR name IN ('Pemex', 'CFE', 'Grupo SSIA');
