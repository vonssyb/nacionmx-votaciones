-- Add columns for AI Stats and CRM
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS closed_by_ai boolean DEFAULT FALSE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ai_analysis text;

-- Index for CRM lookups (faster user history check)
CREATE INDEX IF NOT EXISTS idx_tickets_creator_id ON public.tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
