-- RPC for Atomic Chips Exchange (Buy/Sell) called after/before UB transaction
-- Ensures chips balance and stats are updated consistently
CREATE OR REPLACE FUNCTION execute_chips_exchange(
    p_user_id TEXT,
    p_chips_amount BIGINT, -- Positive to add (Buy), Negative to remove (Sell)
    p_cash_amount BIGINT, -- For logging/audit purposes only (the actual cash is handled by UB)
    p_operation TEXT -- 'buy' or 'sell'
) RETURNS JSONB AS $$
DECLARE
    v_new_chips_balance BIGINT;
    v_account_exists BOOLEAN;
BEGIN
    -- Check if account exists
    SELECT EXISTS(SELECT 1 FROM casino_chips WHERE user_id = p_user_id) INTO v_account_exists;

    IF NOT v_account_exists THEN
        IF p_chips_amount < 0 THEN
             RETURN jsonb_build_object('success', false, 'error', 'No tienes cuenta de casino para vender fichas.');
        END IF;

        -- Create account if buying
        INSERT INTO casino_chips (user_id, chips, chips_balance, total_won, total_lost, games_played)
        VALUES (p_user_id, p_chips_amount, p_chips_amount, 0, 0, 0)
        RETURNING chips_balance INTO v_new_chips_balance;
    ELSE
        -- Update existing
        UPDATE casino_chips
        SET 
            chips = chips + p_chips_amount,
            chips_balance = chips_balance + p_chips_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING chips_balance INTO v_new_chips_balance;
        
        -- Validate non-negative balance (for selling)
        IF v_new_chips_balance < 0 THEN
             RAISE EXCEPTION 'Fondos insuficientes (Chips)';
        END IF;
    END IF;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'new_chips_balance', v_new_chips_balance,
        'operation', p_operation
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC for Atomic Savings Transaction (Deposit/Withdraw)
-- Updates account balance and inserts transaction log atomically
CREATE OR REPLACE FUNCTION execute_savings_transaction(
    p_account_id BIGINT,
    p_user_id TEXT,
    p_amount BIGINT, -- Positive for deposit, Negative for withdraw
    p_transaction_type TEXT, -- 'deposit', 'withdrawal', 'penalty', 'interest'
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_balance BIGINT;
    v_account_owner TEXT;
    v_current_balance BIGINT;
BEGIN
    -- Verify Account Ownership and Lock Row
    SELECT discord_user_id, current_balance INTO v_account_owner, v_current_balance
    FROM savings_accounts 
    WHERE id = p_account_id AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cuenta de ahorro no encontrada o inactiva.');
    END IF;

    IF v_account_owner <> p_user_id AND p_user_id <> 'SYSTEM' THEN
         RETURN jsonb_build_object('success', false, 'error', 'No eres el propietario de esta cuenta.');
    END IF;

    -- Calculate New Balance
    v_new_balance := v_current_balance + p_amount;

    IF v_new_balance < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente en cuenta de ahorro.');
    END IF;

    -- Update Balance
    UPDATE savings_accounts
    SET 
        current_balance = v_new_balance,
        updated_at = NOW() -- Assuming updated_at trigger or column exists
    WHERE id = p_account_id;

    -- Insert Transaction Log
    INSERT INTO savings_transactions (
        account_id,
        transaction_type,
        amount,
        balance_after,
        executed_by,
        notes,
        created_at
    ) VALUES (
        p_account_id,
        p_transaction_type,
        ABS(p_amount), -- Store absolute amount typically? Schema implies amount is usually positive in logs, type defines direction.
        v_new_balance,
        p_user_id,
        p_notes,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'transaction_type', p_transaction_type
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
