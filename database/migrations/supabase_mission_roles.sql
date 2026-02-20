-- Add allowed_roles column to daily_missions
ALTER TABLE daily_missions
ADD COLUMN IF NOT EXISTS allowed_roles text[] DEFAULT NULL;

-- Comment: If allowed_roles is NULL or empty, it means "Open to Everyone".
-- If it contains values like 'security', 'civilian', it restricts to those groups.
