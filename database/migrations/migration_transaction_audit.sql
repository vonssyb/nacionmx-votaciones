-- Migration: Transaction Audit System
-- Creates tables and RPC functions for atomic transaction management
-- Created: 2026-02-12

-- ==============================================
-- 1. AUDIT LOGGING TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS transaction_audit (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL, -- 'casino', 'transfer_out', 'transfer_in', 'bank_deposit', etc.
    amount NUMERIC NOT NULL DEFAULT 0,
    balance_before NUMERIC,
    balance_after NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_audit_user ON transaction_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_created ON transaction_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_type ON transaction_audit(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transaction_audit_user_created ON transaction_audit(user_id, created_at DESC);

-- ==============================================
-- 2. RPC FUNCTION: Casino Transaction (Atomic)
-- ==============================================

CREATE OR REPLACE FUNCTION execute_casino_transaction(
    p_user_id TEXT,
    p_bet_amount NUMERIC,
    p_payout_amount NUMERIC,
    p_game_type TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance NUMERIC,
    balance_before NUMERIC
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_chips NUMERIC;
    v_new_chips NUMERIC;
    v_total_won NUMERIC;
    v_total_lost NUMERIC;
    v_games_played INTEGER;
BEGIN
    -- Lock the row for update
    SELECT chips, total_won, total_lost, games_played
    INTO v_current_chips, v_total_won, v_total_lost, v_games_played
    FROM casino_chips
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Check if account exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Casino account not found for user %', p_user_id;
    END IF;

    -- Check sufficient balance
    IF v_current_chips < p_bet_amount THEN
        RAISE EXCEPTION 'Insufficient chips. Has: %, Needs: %', v_current_chips, p_bet_amount;
    END IF;

    -- Calculate new balance: current - bet + payout
    v_new_chips := v_current_chips - p_bet_amount + p_payout_amount;

    -- Update stats
    IF p_payout_amount > p_bet_amount THEN
        v_total_won := v_total_won + (p_payout_amount - p_bet_amount);
    ELSE
        v_total_lost := v_total_lost + p_bet_amount;
    END IF;

    v_games_played := v_games_played + 1;

    -- Update the account
    UPDATE casino_chips
    SET 
        chips = v_new_chips,
        total_won = v_total_won,
        total_lost = v_total_lost,
        games_played = v_games_played,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Return results
    RETURN QUERY SELECT 
        TRUE as success,
        v_new_chips as new_balance,
        v_current_chips as balance_before;
END;
$$;

-- ==============================================
-- 3. RPC FUNCTION: Chips Exchange (Buy/Sell)
-- ==============================================

CREATE OR REPLACE FUNCTION execute_chips_exchange(
    p_user_id TEXT,
    p_chips_amount NUMERIC,
    p_cash_amount NUMERIC,
    p_operation TEXT -- 'buy' or 'sell'
)
RETURNS TABLE(
    success BOOLEAN,
    new_chips_balance NUMERIC,
    new_cash_balance NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_chips NUMERIC;
    v_current_cash NUMERIC;
BEGIN
    -- Lock both tables
    SELECT chips INTO v_current_chips
    FROM casino_chips
    WHERE user_id = p_user_id
    FOR UPDATE;

    SELECT cash INTO v_current_cash
    FROM users
    WHERE discord_user_id = p_user_id
    FOR UPDATE;

    IF p_operation = 'buy' THEN
        -- Buy chips: subtract cash, add chips
        IF v_current_cash < p_cash_amount THEN
            RAISE EXCEPTION 'Insufficient cash. Has: %, Needs: %', v_current_cash, p_cash_amount;
        END IF;

        UPDATE users SET cash = cash - p_cash_amount WHERE discord_user_id = p_user_id;
        
        -- Create or update casino account
        INSERT INTO casino_chips (user_id, chips, total_won, total_lost, games_played)
        VALUES (p_user_id, p_chips_amount, 0, 0, 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET chips = casino_chips.chips + p_chips_amount;

    ELSIF p_operation = 'sell' THEN
        -- Sell chips: subtract chips, add cash
        IF v_current_chips < p_chips_amount THEN
            RAISE EXCEPTION 'Insufficient chips. Has: %, Needs: %', v_current_chips, p_chips_amount;
        END IF;

        UPDATE casino_chips SET chips = chips - p_chips_amount WHERE user_id = p_user_id;
        UPDATE users SET cash = cash + p_cash_amount WHERE discord_user_id = p_user_id;

    ELSE
        RAISE EXCEPTION 'Invalid operation: %', p_operation;
    END IF;

    -- Get new balances
    SELECT chips INTO v_current_chips FROM casino_chips WHERE user_id = p_user_id;
    SELECT cash INTO v_current_cash FROM users WHERE discord_user_id = p_user_id;

    RETURN QUERY SELECT 
        TRUE as success,
        v_current_chips as new_chips_balance,
        v_current_cash as new_cash_balance;
END;
$$;

-- ==============================================
-- 4. RPC FUNCTION: Money Transfer
-- ==============================================

CREATE OR REPLACE FUNCTION execute_money_transfer(
    p_from_user TEXT,
    p_to_user TEXT,
    p_amount NUMERIC,
    p_transfer_type TEXT, -- 'cash', 'bank'
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    sender_new_balance NUMERIC,
    receiver_new_balance NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sender_balance NUMERIC;
    v_receiver_balance NUMERIC;
    v_column_name TEXT;
BEGIN
    -- Determine column based on transfer type
    v_column_name := CASE 
        WHEN p_transfer_type = 'cash' THEN 'cash'
        WHEN p_transfer_type = 'bank' THEN 'bank'
        ELSE 'cash'
    END;

    -- Lock sender and receiver rows in order to prevent deadlock
    IF p_from_user < p_to_user THEN
        EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1 FOR UPDATE', v_column_name) 
        INTO v_sender_balance USING p_from_user;
        EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1 FOR UPDATE', v_column_name)
        INTO v_receiver_balance USING p_to_user;
    ELSE
        EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1 FOR UPDATE', v_column_name)
        INTO v_receiver_balance USING p_to_user;
        EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1 FOR UPDATE', v_column_name)
        INTO v_sender_balance USING p_from_user;
    END IF;

    -- Validate balances
    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds. Has: %, Needs: %', v_sender_balance, p_amount;
    END IF;

    -- Execute transfer
    EXECUTE format('UPDATE users SET %I = %I - $1 WHERE discord_user_id = $2', v_column_name, v_column_name)
    USING p_amount, p_from_user;
    
    EXECUTE format('UPDATE users SET %I = %I + $1 WHERE discord_user_id = $2', v_column_name, v_column_name)
    USING p_amount, p_to_user;

    -- Get new balances
    EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1', v_column_name)
    INTO v_sender_balance USING p_from_user;
    
    EXECUTE format('SELECT %I FROM users WHERE discord_user_id = $1', v_column_name)
    INTO v_receiver_balance USING p_to_user;

    RETURN QUERY SELECT 
        TRUE as success,
        v_sender_balance as sender_new_balance,
        v_receiver_balance as receiver_new_balance;
END;
$$;

-- ==============================================
-- 5. RPC FUNCTION: Bank Operation
-- ==============================================

CREATE OR REPLACE FUNCTION execute_bank_operation(
    p_user_id TEXT,
    p_amount NUMERIC,
    p_operation TEXT -- 'deposit' or 'withdraw'
)
RETURNS TABLE(
    success BOOLEAN,
    new_cash_balance NUMERIC,
    new_bank_balance NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cash NUMERIC;
    v_bank NUMERIC;
BEGIN
    -- Lock user row
    SELECT cash, bank INTO v_cash, v_bank
    FROM users
    WHERE discord_user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    IF p_operation = 'deposit' THEN
        -- Deposit: cash -> bank
        IF v_cash < p_amount THEN
            RAISE EXCEPTION 'Insufficient cash. Has: %, Needs: %', v_cash, p_amount;
        END IF;

        UPDATE users 
        SET cash = cash - p_amount, bank = bank + p_amount
        WHERE discord_user_id = p_user_id;

    ELSIF p_operation = 'withdraw' THEN
        -- Withdraw: bank -> cash
        IF v_bank < p_amount THEN
            RAISE EXCEPTION 'Insufficient bank balance. Has: %, Needs: %', v_bank, p_amount;
        END IF;

        UPDATE users
        SET cash = cash + p_amount, bank = bank - p_amount
        WHERE discord_user_id = p_user_id;

    ELSE
        RAISE EXCEPTION 'Invalid operation: %', p_operation;
    END IF;

    -- Get new balances
    SELECT cash, bank INTO v_cash, v_bank
    FROM users
    WHERE discord_user_id = p_user_id;

    RETURN QUERY SELECT
        TRUE as success,
        v_cash as new_cash_balance,
        v_bank as new_bank_balance;
END;
$$;

-- ==============================================
-- 6. GRANT PERMISSIONS
-- ==============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION execute_casino_transaction TO authenticated, anon;
GRANT EXECUTE ON FUNCTION execute_chips_exchange TO authenticated, anon;
GRANT EXECUTE ON FUNCTION execute_money_transfer TO authenticated, anon;
GRANT EXECUTE ON FUNCTION execute_bank_operation TO authenticated, anon;

-- Grant table permissions
GRANT SELECT, INSERT ON transaction_audit TO authenticated, anon;
