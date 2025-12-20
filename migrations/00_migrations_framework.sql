-- ===================================================================
-- Database Migrations Framework
-- Fase 5, Item #19: DB Migrations as Code
-- ===================================================================

-- Table: schema_migrations
-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  checksum TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_migrations_applied ON schema_migrations(applied_at DESC);

-- Function: record_migration
-- Record a successful migration
CREATE OR REPLACE FUNCTION record_migration(
  p_version BIGINT,
  p_name TEXT,
  p_checksum TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
  VALUES (p_version, p_name, p_checksum, p_execution_time_ms)
  ON CONFLICT (version) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Function: is_migration_applied
-- Check if migration has been applied
CREATE OR REPLACE FUNCTION is_migration_applied(p_version BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = p_version);
$$;

-- Function: get_latest_migration
-- Get the latest applied migration version
CREATE OR REPLACE FUNCTION get_latest_migration()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(version), 0) FROM schema_migrations;
$$;

-- Grant permissions
GRANT SELECT, INSERT ON schema_migrations TO service_role;
GRANT EXECUTE ON FUNCTION record_migration TO service_role;
GRANT EXECUTE ON FUNCTION is_migration_applied TO service_role;
GRANT EXECUTE ON FUNCTION get_latest_migration TO service_role;

DO $$
BEGIN
  RAISE NOTICE 'Database migrations framework created!';
  RAISE NOTICE 'Table: schema_migrations';
  RAISE NOTICE 'Functions: record_migration, is_migration_applied, get_latest_migration';
END $$;
