-- Migration: Create streaks table for tracking user daily streaks
-- Purpose: Track consecutive days of activity (fichar) with rewards

CREATE TABLE IF NOT EXISTS user_streaks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_claim_date TIMESTAMP WITH TIME ZONE,
    streak_started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_claims INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current_streak ON user_streaks(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_streaks_longest_streak ON user_streaks(longest_streak DESC);

-- Comments
COMMENT ON TABLE user_streaks IS 'Tracks user daily activity streaks for rewards system';
COMMENT ON COLUMN user_streaks.current_streak IS 'Current consecutive days streak';
COMMENT ON COLUMN user_streaks.longest_streak IS 'Personal record of longest streak';
COMMENT ON COLUMN user_streaks.last_claim_date IS 'Last time user claimed their daily/fichar';
COMMENT ON COLUMN user_streaks.total_claims IS 'Total number of times user has claimed';
