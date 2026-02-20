-- Migration: Create server events table for random server-wide events
-- Purpose: Track active events with multipliers and time windows

CREATE TABLE IF NOT EXISTS server_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    multiplier DECIMAL(10, 2) DEFAULT 1.0,
    event_data JSONB DEFAULT '{}',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for event history/analytics
CREATE TABLE IF NOT EXISTS event_history (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES server_events(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    participants INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    total_impact BIGINT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_server_events_is_active ON server_events(is_active);
CREATE INDEX IF NOT EXISTS idx_server_events_event_type ON server_events(event_type);
CREATE INDEX IF NOT EXISTS idx_server_events_time_range ON server_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON event_history(event_id);

-- Comments
COMMENT ON TABLE server_events IS 'Active server-wide events with modifiers';
COMMENT ON COLUMN server_events.event_type IS 'Type: DOUBLE_SALARY, CASINO_LUCK, CRISIS, FESTIVAL, DOUBLE_XP';
COMMENT ON COLUMN server_events.multiplier IS 'Multiplier to apply to affected actions';
COMMENT ON COLUMN server_events.event_data IS 'Additional event configuration as JSON';
COMMENT ON TABLE event_history IS 'Historical record of past events for analytics';
