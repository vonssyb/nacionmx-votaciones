-- ===================================================================
-- Fase 4, Item #13: P2P Loans System
-- SQL Tables for peer-to-peer lending
-- ===================================================================

-- Table: loan_offers
-- Available loan offers from lenders
CREATE TABLE IF NOT EXISTS loan_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lender_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL, -- Annual %
  duration_days INTEGER NOT NULL,
  collateral_percentage NUMERIC DEFAULT 110, -- % of loan required as collateral
  status TEXT DEFAULT 'active', -- 'active', 'accepted', 'cancelled'
  accepted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_loan_offers_status ON loan_offers(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_loan_offers_lender ON loan_offers(lender_id);

-- Table: loans
-- Active and completed loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID REFERENCES loan_offers(id),
  lender_id TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  principal_amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  collateral_amount NUMERIC NOT NULL,
  total_repayment NUMERIC NOT NULL, -- principal + interest
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'repaid', 'defaulted'
  repaid_at TIMESTAMPTZ,
  defaulted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_due ON loans(due_date) WHERE status = 'active';

-- Function: create_loan_offer
CREATE OR REPLACE FUNCTION create_loan_offer(
  p_lender_id TEXT,
  p_amount NUMERIC,
  p_interest_rate NUMERIC,
  p_duration_days INTEGER,
  p_collateral_pct NUMERIC DEFAULT 110
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer_id UUID;
BEGIN
  INSERT INTO loan_offers (
    lender_id,
    amount,
    interest_rate,
    duration_days,
    collateral_percentage
  )
  VALUES (
    p_lender_id,
    p_amount,
    p_interest_rate,
    p_duration_days,
    p_collateral_pct
  )
  RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$;

-- Function: accept_loan_offer
-- Accept offer and create active loan
CREATE OR REPLACE FUNCTION accept_loan_offer(
  p_offer_id UUID,
  p_borrower_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_offer loan_offers;
  v_loan_id UUID;
  v_collateral NUMERIC;
  v_total_repayment NUMERIC;
  v_due_date TIMESTAMPTZ;
BEGIN
  -- Get offer
  SELECT * INTO v_offer
  FROM loan_offers
  WHERE id = p_offer_id
    AND status = 'active'
  FOR UPDATE;

  IF v_offer IS NULL THEN
    RAISE EXCEPTION 'Loan offer not found or already accepted';
  END IF;

  IF v_offer.lender_id = p_borrower_id THEN
    RAISE EXCEPTION 'Cannot borrow from yourself';
  END IF;

  -- Calculate amounts
  v_collateral := v_offer.amount * (v_offer.collateral_percentage / 100);
  v_total_repayment := v_offer.amount + (v_offer.amount * v_offer.interest_rate / 100 * v_offer.duration_days / 365);
  v_due_date := NOW() + (v_offer.duration_days || ' days')::INTERVAL;

  -- Mark offer as accepted
  UPDATE loan_offers
  SET status = 'accepted', accepted_by = p_borrower_id
  WHERE id = p_offer_id;

  -- Create active loan
  INSERT INTO loans (
    offer_id,
    lender_id,
    borrower_id,
    principal_amount,
    interest_rate,
    collateral_amount,
    total_repayment,
    due_date
  )
  VALUES (
    p_offer_id,
    v_offer.lender_id,
    p_borrower_id,
    v_offer.amount,
    v_offer.interest_rate,
    v_collateral,
    v_total_repayment,
    v_due_date
  )
  RETURNING id INTO v_loan_id;

  RETURN v_loan_id;
END;
$$;

-- Function: repay_loan
CREATE OR REPLACE FUNCTION repay_loan(p_loan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE loans
  SET 
    status = 'repaid',
    repaid_at = NOW()
  WHERE id = p_loan_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found or already repaid';
  END IF;

  RETURN TRUE;
END;
$$;

-- Function: default_loan
CREATE OR REPLACE FUNCTION default_loan(p_loan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE loans
  SET 
    status = 'defaulted',
    defaulted_at = NOW()
  WHERE id = p_loan_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found or already completed';
  END IF;

  RETURN TRUE;
END;
$$;

-- Function: get_active_loan_offers
CREATE OR REPLACE FUNCTION get_active_loan_offers()
RETURNS SETOF loan_offers
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM loan_offers
  WHERE status = 'active'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 50;
$$;

-- Function: get_overdue_loans
CREATE OR REPLACE FUNCTION get_overdue_loans()
RETURNS SETOF loans
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM loans
  WHERE status = 'active'
    AND due_date < NOW();
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON loan_offers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON loans TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_loan_offer TO service_role;
GRANT EXECUTE ON FUNCTION accept_loan_offer TO service_role;
GRANT EXECUTE ON FUNCTION repay_loan TO service_role;
GRANT EXECUTE ON FUNCTION default_loan TO service_role;
GRANT EXECUTE ON FUNCTION get_active_loan_offers TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_overdue_loans TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'P2P Loans system created successfully!';
  RAISE NOTICE 'Tables: loan_offers, loans';
  RAISE NOTICE 'Functions: create_loan_offer, accept_loan_offer, repay_loan, default_loan';
END $$;
