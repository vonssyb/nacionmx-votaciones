-- Migration: Create daily rewards table for improved daily claim system
-- Purpose: Track daily reward claims with consecutive day bonuses

CREATE TABLE IF NOT EXISTS daily_rewards (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    last_claim_date TIMESTAMP WITH TIME ZONE,
    consecutive_days INTEGER DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    total_earned BIGINT DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_bonus_amount BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for reward claim history
CREATE TABLE IF NOT EXISTS daily_reward_claims (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    claim_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    consecutive_day INTEGER NOT NULL,
    base_reward BIGINT NOT NULL,
    bonus_reward BIGINT DEFAULT 0,
    total_reward BIGINT NOT NULL,
    was_lucky_bonus BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON daily_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_consecutive_days ON daily_rewards(consecutive_days DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user_id ON daily_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_date ON daily_reward_claims(claim_date DESC);

-- Comments
COMMENT ON TABLE daily_rewards IS 'Tracks user daily reward claims with streaks';
COMMENT ON COLUMN daily_rewards.consecutive_days IS 'Current consecutive days of claiming';
COMMENT ON COLUMN daily_rewards.best_streak IS 'Best consecutive streak achieved';
COMMENT ON TABLE daily_reward_claims IS 'History of all daily reward claims';
COMMENT ON COLUMN daily_reward_claims.was_lucky_bonus IS 'Whether user got lucky random bonus';
