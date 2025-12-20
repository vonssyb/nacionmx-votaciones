-- ============================================
-- CASINO SYSTEM TABLES
-- ============================================

-- Casino chips balance
CREATE TABLE IF NOT EXISTS casino_chips (
    user_id TEXT PRIMARY KEY,
    chips NUMERIC DEFAULT 0 CHECK (chips >= 0),
    total_bought NUMERIC DEFAULT 0,
    total_cashed_out NUMERIC DEFAULT 0,
    total_won NUMERIC DEFAULT 0,
    total_lost NUMERIC DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casino game history
CREATE TABLE IF NOT EXISTS casino_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    game_type TEXT NOT NULL, -- slots, dice, blackjack, roulette
    bet_amount NUMERIC NOT NULL,
    result TEXT NOT NULL, -- win, loss, push
    payout NUMERIC DEFAULT 0,
    details JSONB, -- game-specific details
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_casino_chips_chips ON casino_chips(chips DESC);
CREATE INDEX IF NOT EXISTS idx_casino_games_user ON casino_games(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_casino_games_type ON casino_games(game_type, created_at DESC);

-- Comments
COMMENT ON TABLE casino_chips IS 'User casino chip balances and stats';
COMMENT ON TABLE casino_games IS 'Casino game history for tracking';
