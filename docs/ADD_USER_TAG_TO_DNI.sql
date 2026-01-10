-- Add user_tag column to citizen_dni table
-- This column stores the Roblox username for DNI records

ALTER TABLE citizen_dni 
ADD COLUMN IF NOT EXISTS user_tag TEXT;

-- Add comment for documentation
COMMENT ON COLUMN citizen_dni.user_tag IS 'Roblox username of the citizen';

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_citizen_dni_user_tag ON citizen_dni(user_tag);
