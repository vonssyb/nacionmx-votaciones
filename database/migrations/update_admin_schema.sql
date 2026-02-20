-- Add admin_notes column to applications table if it doesn't exist
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Verify the column was added (optional, for manual confirmation)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'applications';
    