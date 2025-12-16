-- Add Credit Score to Citizens
ALTER TABLE public.citizens ADD COLUMN IF NOT EXISTS credit_score INTEGER DEFAULT 100;

-- Comment on column
COMMENT ON COLUMN public.citizens.credit_score IS 'Buró Financiero: 0-100 Score. Starts at 100.';
