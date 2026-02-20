-- Hybrid Economy: USD Support for NACION MX
-- Mexican Pesos (MXN) are stored in UnbelievaBoat
-- US Dollars (USD) are stored in this custom table

CREATE TABLE IF NOT EXISTS user_usd_balances (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    usd_cash NUMERIC DEFAULT 0,
    usd_bank NUMERIC DEFAULT 0,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
);

-- Exchange Rate Table (Control central del staff)
CREATE TABLE IF NOT EXISTS exchange_rates (
    guild_id TEXT PRIMARY KEY,
    mxn_to_usd NUMERIC DEFAULT 22.50, -- Tasa default (1 USD = 22.50 MXN)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by TEXT
);

-- Register initial rate for the main guild if known
-- (User should run this or the bot will auto-create on first use)

-- RPC to exchange money safely
CREATE OR REPLACE FUNCTION exchange_currency(
    p_guild_id TEXT,
    p_user_id TEXT,
    p_amount_mxn NUMERIC,
    p_amount_usd NUMERIC,
    p_direction TEXT -- 'to_usd' or 'to_mxn'
) RETURNS JSON AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    -- Get current rate
    SELECT mxn_to_usd INTO v_rate FROM exchange_rates WHERE guild_id = p_guild_id;
    IF v_rate IS NULL THEN v_rate := 20.0; END IF;

    -- Update USD balances
    INSERT INTO user_usd_balances (guild_id, user_id, usd_bank)
    VALUES (p_guild_id, p_user_id, CASE WHEN p_direction = 'to_usd' THEN p_amount_usd ELSE -p_amount_usd END)
    ON CONFLICT (guild_id, user_id) DO UPDATE
    SET usd_bank = user_usd_balances.usd_bank + (CASE WHEN p_direction = 'to_usd' THEN p_amount_usd ELSE -p_amount_usd END),
        last_update = NOW();

    RETURN json_build_object('success', true, 'rate', v_rate);
END;
$$ LANGUAGE plpgsql;
