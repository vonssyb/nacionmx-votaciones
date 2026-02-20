-- Update constraint to allow 'appealed' status
ALTER TABLE sanctions DROP CONSTRAINT IF EXISTS sanctions_status_check;

ALTER TABLE sanctions ADD CONSTRAINT sanctions_status_check 
CHECK (status IN ('active', 'appealed', 'archived', 'canceled', 'void', 'expired'));
