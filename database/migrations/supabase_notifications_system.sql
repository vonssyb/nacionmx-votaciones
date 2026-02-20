-- ===================================================================
-- Fase 3, Item #7: Smart Notifications System
-- SQL Tables and Functions
-- ===================================================================

-- Table: notification_log
-- Stores all sent notifications for history and analytics
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  content JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  read BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_date ON notification_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_type ON notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_notif_log_unread ON notification_log(user_id, read) WHERE read = false;

-- Table: notification_preferences
-- User preferences for notification types
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  weekly_summary BOOLEAN DEFAULT true,
  payment_reminders BOOLEAN DEFAULT true,
  debt_alerts BOOLEAN DEFAULT true,
  transaction_grouping BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function: get_notification_prefs
-- Returns user preferences, creating defaults if not exists
CREATE OR REPLACE FUNCTION get_notification_prefs(p_user_id TEXT)
RETURNS notification_preferences
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefs notification_preferences;
BEGIN
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;
  
  RETURN v_prefs;
END;
$$;

-- Function: log_notification
-- Helper to log sent notifications
CREATE OR REPLACE FUNCTION log_notification(
  p_user_id TEXT,
  p_type TEXT,
  p_content JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_log (user_id, notification_type, content)
  VALUES (p_user_id, p_type, p_content)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function: get_weekly_stats
-- Calculate user stats for weekly summary
CREATE OR REPLACE FUNCTION get_weekly_stats(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stats JSONB;
  v_spent NUMERIC := 0;
  v_received NUMERIC := 0;
  v_start_balance NUMERIC := 0;
  v_end_balance NUMERIC := 0;
BEGIN
  -- Get transactions from last 7 days
  SELECT 
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)
  INTO v_spent, v_received
  FROM transaction_logs
  WHERE discord_user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '7 days'
    AND status = 'SUCCESS';
  
  -- Get current balance
  SELECT COALESCE(SUM(balance), 0)
  INTO v_end_balance
  FROM debit_cards
  WHERE discord_user_id = p_user_id
    AND status = 'active';
  
  -- Calculate start balance
  v_start_balance := v_end_balance + v_spent - v_received;
  
  v_stats := jsonb_build_object(
    'spent', v_spent,
    'received', v_received,
    'start_balance', v_start_balance,
    'end_balance', v_end_balance,
    'change', v_end_balance - v_start_balance
  );
  
  RETURN v_stats;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON notification_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_notification_prefs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION log_notification TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_weekly_stats TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Smart Notifications tables created successfully!';
  RAISE NOTICE 'Tables: notification_log, notification_preferences';
  RAISE NOTICE 'Functions: get_notification_prefs, log_notification, get_weekly_stats';
END $$;
