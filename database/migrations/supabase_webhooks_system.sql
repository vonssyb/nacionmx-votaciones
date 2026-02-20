-- ===================================================================
-- Fase 3, Item #10: Webhooks for Events
-- SQL Tables for webhook configuration and tracking
-- ===================================================================

-- Table: webhooks
-- Webhook endpoint configurations
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event types
  secret TEXT, -- For signature validation
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active) WHERE active = true;

-- Table: webhook_deliveries
-- Track webhook delivery attempts and results
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'success', 'failed'
  http_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- Function: get_active_webhooks_for_event
-- Get webhooks that should receive this event type
CREATE OR REPLACE FUNCTION get_active_webhooks_for_event(p_event_type TEXT)
RETURNS SETOF webhooks
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM webhooks
  WHERE active = true
    AND p_event_type = ANY(events);
$$;

-- Function: record_webhook_delivery
-- Record a webhook delivery attempt
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_webhook_id UUID,
  p_event_type TEXT,
  p_payload JSONB,
  p_status TEXT,
  p_http_status INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery_id UUID;
  v_attempts INTEGER;
  v_max_attempts INTEGER;
  v_next_retry TIMESTAMPTZ;
BEGIN
  -- Get current attempts
  SELECT attempts, max_attempts
  INTO v_attempts, v_max_attempts
  FROM webhook_deliveries
  WHERE webhook_id = p_webhook_id
    AND event_type = p_event_type
    AND payload = p_payload
  ORDER BY created_at DESC
  LIMIT 1;

  v_attempts := COALESCE(v_attempts, 0) + 1;
  v_max_attempts := COALESCE(v_max_attempts, 3);

  -- Calculate next retry (exponential backoff: 1min, 5min, 30min)
  IF p_status = 'failed' AND v_attempts < v_max_attempts THEN
    v_next_retry := NOW() + (POWER(5, v_attempts) || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO webhook_deliveries (
    webhook_id,
    event_type,
    payload,
    status,
    http_status,
    response_body,
    attempts,
    max_attempts,
    next_retry_at,
    completed_at
  )
  VALUES (
    p_webhook_id,
    p_event_type,
    p_payload,
    p_status,
    p_http_status,
    p_response_body,
    v_attempts,
    v_max_attempts,
    v_next_retry,
    CASE WHEN p_status IN ('success', 'failed') AND v_attempts >= v_max_attempts THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_delivery_id;

  RETURN v_delivery_id;
END;
$$;

-- Function: get_pending_retries
-- Get webhook deliveries that need to be retried
CREATE OR REPLACE FUNCTION get_pending_retries()
RETURNS SETOF webhook_deliveries
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM webhook_deliveries
  WHERE status = 'pending'
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= NOW()
    AND attempts < max_attempts
  ORDER BY next_retry_at
  LIMIT 100;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON webhook_deliveries TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_active_webhooks_for_event TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_webhook_delivery TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_retries TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Webhooks system created successfully!';
  RAISE NOTICE 'Tables: webhooks, webhook_deliveries';
  RAISE NOTICE 'Functions: get_active_webhooks_for_event, record_webhook_delivery, get_pending_retries';
END $$;
