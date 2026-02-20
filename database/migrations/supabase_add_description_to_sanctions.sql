-- Add description column to sanctions table
ALTER TABLE sanctions
ADD COLUMN IF NOT EXISTS description TEXT;
