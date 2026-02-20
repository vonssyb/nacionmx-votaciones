-- Casino System Tables
-- Migration for casino chips and games tracking

-- Table for user casino chips and statistics
CREATE TABLE IF NOT EXISTS casino_chips (
    user_id TEXT PRIMARY KEY,
    chips INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_lost INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table for multiplayer games state
CREATE TABLE IF NOT EXISTS casino_games (
    game_id TEXT PRIMARY KEY,
    game_type TEXT NOT NULL, -- 'blackjack', 'coinflip'
    players JSONB NOT NULL DEFAULT '[]',
    bets JSONB NOT NULL DEFAULT '{}',
    game_state JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
    channel_id TEXT,
    message_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_casino_games_status ON casino_games(status);
CREATE INDEX IF NOT EXISTS idx_casino_games_type ON casino_games(game_type);

-- Table for game history (optional, for analytics)
CREATE TABLE IF NOT EXISTS casino_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    bet_amount INTEGER NOT NULL,
    result INTEGER NOT NULL, -- positive = won, negative = lost
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casino_history_user ON casino_history(user_id);
CREATE INDEX IF NOT EXISTS idx_casino_history_date ON casino_history(created_at);
