-- Quick Win #21: Critical Database Indexes
-- These indexes dramatically improve query performance
-- SAFE: Creating indexes does NOT modify data

-- ========================================
-- Transaction Logs Indexes
-- ========================================

-- Most common query: get transactions by user, sorted by date
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user_date 
ON transaction_logs(discord_user_id, created_at DESC);

-- Query transactions by card
CREATE INDEX IF NOT EXISTS idx_transaction_logs_card 
ON transaction_logs(card_id);

-- Query by status (find failed transactions)
CREATE INDEX IF NOT EXISTS idx_transaction_logs_status 
ON transaction_logs(status) 
WHERE status != 'SUCCESS';

-- ========================================
-- Debit Transactions Indexes  
-- ========================================

-- Get transactions by user
CREATE INDEX IF NOT EXISTS idx_debit_transactions_user_date
ON debit_transactions(discord_user_id, created_at DESC);

-- Get transactions by card
CREATE INDEX IF NOT EXISTS idx_debit_transactions_card
ON debit_transactions(debit_card_id);

-- ========================================
-- Credit Cards Indexes
-- ========================================

-- Find active cards by user
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_status
ON credit_cards(discord_user_id, status)
WHERE status = 'active';

-- Find cards needing payment (high debt)
CREATE INDEX IF NOT EXISTS idx_credit_cards_debt
ON credit_cards(current_balance DESC)
WHERE status = 'active' AND current_balance > 0;

-- ========================================
-- Business Credit Cards Indexes
-- ========================================

-- Find business cards by company
CREATE INDEX IF NOT EXISTS idx_biz_cards_company
ON business_credit_cards(company_id);

-- Active business cards
CREATE INDEX IF NOT EXISTS idx_biz_cards_active
ON business_credit_cards(discord_user_id)
WHERE status = 'active';

-- ========================================
-- Companies Indexes
-- ========================================

-- Find companies by owner
CREATE INDEX IF NOT EXISTS idx_companies_owner
ON companies(owner_id);

-- Active companies sorted by balance
CREATE INDEX IF NOT EXISTS idx_companies_balance
ON companies(balance DESC)
WHERE active = true;

-- ========================================
-- Debit Cards Indexes
-- ========================================

-- Find active debit cards by user
CREATE INDEX IF NOT EXISTS idx_debit_cards_user_active
ON debit_cards(discord_user_id)
WHERE status = 'active';

-- Find cards by tier (for upgrades)
CREATE INDEX IF NOT EXISTS idx_debit_cards_tier
ON debit_cards(card_tier);

-- ========================================
-- Payroll Indexes
-- ========================================

-- Payroll members by group
CREATE INDEX IF NOT EXISTS idx_payroll_members_group
ON payroll_members(group_id);

-- Active payroll groups
CREATE INDEX IF NOT EXISTS idx_payroll_groups_company
ON payroll_groups(company_id)
WHERE active = true;

-- ========================================
-- Performance Analysis
-- ========================================

-- After creating indexes, analyze tables for query planner
ANALYZE transaction_logs;
ANALYZE debit_transactions;
ANALYZE credit_cards;
ANALYZE business_credit_cards;
ANALYZE companies;
ANALYZE debit_cards;
ANALYZE payroll_members;
ANALYZE payroll_groups;

-- ========================================
-- Verification Query
-- ========================================

-- Count indexes created
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
