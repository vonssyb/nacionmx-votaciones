-- Update Sanctions Status Constraint
-- Original Constraint: CHECK (status IN ('active', 'appealed', 'archived', 'canceled'))
-- New Constraint: Include 'void' and 'expired'

ALTER TABLE sanctions 
DROP CONSTRAINT IF EXISTS sanctions_status_check;

ALTER TABLE sanctions 
ADD CONSTRAINT sanctions_status_check 
CHECK (status IN ('active', 'appealed', 'archived', 'canceled', 'void', 'expired'));

-- Create new RPC function if needed, but constraint update is enough for direct queries.
