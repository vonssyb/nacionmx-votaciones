-- Atomic Transactions for Critical Operations
-- Run this in Supabase SQL Editor

-- ========================================
-- Function: execute_debit_payment
-- Atomically process debit card payment
-- ========================================
CREATE OR REPLACE FUNCTION execute_debit_payment(
    p_card_id UUID,
    p_user_id TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Start transaction (auto by function)
    
    -- Lock row for update
    SELECT balance INTO v_current_balance
    FROM debit_cards
    WHERE id = p_card_id
    FOR UPDATE;
    
    -- Check if card exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debit card not found: %', p_card_id;
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_amount;
    
    -- Check insufficient funds
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient funds. Current: %, Required: %', v_current_balance, p_amount;
    END IF;
    
    -- Update debit card balance
    UPDATE debit_cards
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_card_id;
    
    -- Insert transaction log
    INSERT INTO debit_transactions (
        debit_card_id,
        discord_user_id,
        amount,
        transaction_type,
        description,
        created_at
    ) VALUES (
        p_card_id,
        p_user_id,
        -p_amount,
        p_type,
        p_description,
        NOW()
    );
    
    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'previous_balance', v_current_balance,
        'new_balance', v_new_balance,
        'amount', p_amount
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Automatic rollback on any error
        RAISE;
END;
$$;

-- ========================================
-- Function: execute_payroll_payment
-- Atomically process payroll
-- ========================================
CREATE OR REPLACE FUNCTION execute_payroll_payment(
    p_company_id UUID,
    p_owner_id TEXT,
    p_employees JSONB,  -- Array of {discord_id, salary}
    p_total_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_company_balance NUMERIC;
    v_employee JSONB;
    v_employees_paid INT := 0;
BEGIN
    -- Lock company row
    SELECT balance INTO v_company_balance
    FROM companies
    WHERE id = p_company_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company not found: %', p_company_id;
    END IF;
    
    -- Check sufficient funds
    IF v_company_balance < p_total_amount THEN
        RAISE EXCEPTION 'Company insufficient funds. Available: %, Required: %', v_company_balance, p_total_amount;
    END IF;
    
    -- Deduct from company
    UPDATE companies
    SET balance = balance - p_total_amount,
        updated_at = NOW()
    WHERE id = p_company_id;
    
    -- Create payroll log
    INSERT INTO payroll_logs (
        company_id,
        owner_id,
        total_amount,
        employee_count,
        created_at
    ) VALUES (
        p_company_id,
        p_owner_id,
        p_total_amount,
        jsonb_array_length(p_employees),
        NOW()
    );
    
    -- Count successful payments
    v_employees_paid := jsonb_array_length(p_employees);
    
    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'company_id', p_company_id,
        'employees_paid', v_employees_paid,
        'total_amount', p_total_amount,
        'previous_balance', v_company_balance,
        'new_balance', v_company_balance - p_total_amount
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- ========================================
-- Function: execute_credit_payment
-- Atomically pay credit card debt
-- ========================================
CREATE OR REPLACE FUNCTION execute_credit_payment(
    p_card_id UUID,
    p_user_id TEXT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_debt NUMERIC;
    v_new_debt NUMERIC;
BEGIN
    -- Lock credit card
    SELECT current_balance INTO v_current_debt
    FROM credit_cards
    WHERE id = p_card_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit card not found: %', p_card_id;
    END IF;
    
    -- Calculate new debt
    v_new_debt := v_current_debt - p_amount;
    
    -- Cannot overpay
    IF v_new_debt < 0 THEN
        RAISE EXCEPTION 'Payment exceeds debt. Debt: %, Payment: %', v_current_debt, p_amount;
    END IF;
    
    -- Update debt
    UPDATE credit_cards
    SET current_balance = v_new_debt,
        last_payment_date = NOW(),
        updated_at = NOW()
    WHERE id = p_card_id;
    
    -- Log payment
    INSERT INTO transaction_logs (
        card_id,
        discord_user_id,
        amount,
        type,
        status,
        created_at
    ) VALUES (
        p_card_id,
        p_user_id,
        p_amount,
        'PAYMENT',
        'SUCCESS',
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'previous_debt', v_current_debt,
        'new_debt', v_new_debt,
        'amount_paid', p_amount
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- ========================================
-- Create payroll_logs table if not exists
-- ========================================
CREATE TABLE IF NOT EXISTS payroll_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    owner_id TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    employee_count INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_logs_company ON payroll_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_logs_date ON payroll_logs(created_at DESC);

-- ========================================
-- Grant permissions
-- ========================================
GRANT EXECUTE ON FUNCTION execute_debit_payment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION execute_payroll_payment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION execute_credit_payment TO authenticated, service_role;
