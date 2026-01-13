-- 1. Add columns to 'applications' table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS processed_by TEXT, -- Discord ID or Name of staff
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 2. Create 'bot_settings' table for dynamic configuration
CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- 4. Policies for bot_settings
-- Allow Read for authentication users (or just anon if needed for bot, but bot uses service role)
CREATE POLICY "Allow read access for authenticated users" ON bot_settings
    FOR SELECT TO authenticated USING (true);

-- Allow Insert/Update only for specific admins (logic handled in app usually, but we allow auth users for now)
CREATE POLICY "Allow all access for authenticated users" ON bot_settings
    FOR ALL TO authenticated USING (true);

-- 5. Insert default configuration for Staff Roles
-- Default Roles: 1460678189104894138, 1460071124074233897, 1460074363708768391
INSERT INTO bot_settings (key, value, description)
VALUES (
    'staff_approval_roles', 
    '["1460678189104894138", "1460071124074233897", "1460074363708768391"]'::jsonb, 
    'Roles ID list to assign when a staff application is approved'
)
ON CONFLICT (key) DO NOTHING;

-- 6. Insert default configuration for Staff Guild ID
INSERT INTO bot_settings (key, value, description)
VALUES (
    'staff_guild_id', 
    '"1460059764494041211"'::jsonb, 
    'Guild ID where the staff roles should be assigned'
)
ON CONFLICT (key) DO NOTHING;
