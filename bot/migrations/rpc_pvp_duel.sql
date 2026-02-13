-- Function to execute a PvP duel (Coinflip, etc) atomically
-- deducts bet from both, adds winning pot (minus tax) to winner
CREATE OR REPLACE FUNCTION execute_pvp_duel(
    p_winner_id TEXT,
    p_loser_id TEXT,
    p_bet_amount BIGINT,
    p_game_type TEXT,
    p_tax_percent NUMERIC DEFAULT 0.05
) RETURNS JSONB AS $$
DECLARE
    v_winner_balance BIGINT;
    v_loser_balance BIGINT;
    v_pot BIGINT;
    v_tax BIGINT;
    v_win_amount BIGINT;
    v_winner_won_total BIGINT;
    v_loser_lost_total BIGINT;
BEGIN
    -- 1. Verify balances check (optional, but good safety)
    -- We assume application layer checked, but DB ensure constraints
    -- Fetch current balances for logging or verification?
    
    -- 2. Calculate Pot and Win Amount
    v_pot := p_bet_amount * 2;
    v_tax := FLOOR(v_pot * p_tax_percent);
    v_win_amount := v_pot - v_tax;

    -- 3. Deduction Phase (Loser)
    UPDATE casino_chips
    SET 
        chips = chips - p_bet_amount, -- Legacy column
        chips_balance = chips_balance - p_bet_amount, -- New column convention if exists, else chips
        total_lost = COALESCE(total_lost, 0) + p_bet_amount,
        games_played = COALESCE(games_played, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_loser_id
    RETURNING chips INTO v_loser_balance;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loser account not found');
    END IF;

    -- 4. Addition Phase (Winner)
    -- Winner pays bet too? Logic:
    -- If A and B bet 100. Pot is 200. Tax 10. Win 190.
    -- A starts with 1000. 
    -- If we just add (190 - 100) = 90 profit?
    -- Standard logic: Deduct bet from both? Yes.
    -- Then add win_amount to winner.
    
    -- Winner update:
    -- chips = chips - bet + win_amount
    -- net change = + (win_amount - bet)
    
    UPDATE casino_chips
    SET 
        chips = chips - p_bet_amount + v_win_amount,
        chips_balance = chips_balance - p_bet_amount + v_win_amount,
        total_won = COALESCE(total_won, 0) + (v_win_amount - p_bet_amount),
        games_played = COALESCE(games_played, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_winner_id
    RETURNING chips INTO v_winner_balance;

    IF NOT FOUND THEN
         -- Rollback? Postgres function is atomic. If this fails, transaction fails?
         -- But we need to raise exception to rollback loser update?
         RAISE EXCEPTION 'Winner account not found';
    END IF;

    -- 5. Insert Audit Log (Optional here or via App)
    -- We'll return data for App to log to transaction_audit
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_new_balance', v_winner_balance,
        'loser_new_balance', v_loser_balance,
        'pot', v_pot,
        'tax', v_tax,
        'win_amount', v_win_amount
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
