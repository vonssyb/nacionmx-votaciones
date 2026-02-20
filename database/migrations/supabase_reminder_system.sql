-- Add reminder-related columns to existing tables

-- Add threshold_alerted to session_votes table
ALTER TABLE IF EXISTS public.session_votes
ADD COLUMN IF NOT EXISTS threshold_alerted BOOLEAN DEFAULT FALSE;

-- Add last_afk_alert to staff_shifts table (if it exists)
ALTER TABLE IF EXISTS public.staff_shifts
ADD COLUMN IF NOT EXISTS last_afk_alert TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_votes_status_threshold 
ON public.session_votes(status, threshold_alerted) 
WHERE status = 'active' AND threshold_alerted = FALSE;

CREATE INDEX IF NOT EXISTS idx_staff_shifts_active 
ON public.staff_shifts(start_time) 
WHERE end_time IS NULL;

COMMENT ON COLUMN public.session_votes.threshold_alerted IS 'Flag to prevent duplicate vote threshold alerts';
COMMENT ON COLUMN public.staff_shifts.last_afk_alert IS 'Timestamp of last AFK warning sent for this shift';
