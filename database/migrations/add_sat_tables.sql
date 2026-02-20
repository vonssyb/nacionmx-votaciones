-- SAT (Servicio de Administración Tributaria) Tables

-- 1. Tax Debts (Deudas Fiscales)
CREATE TABLE IF NOT EXISTS public.sat_tax_debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, -- Discord ID
    concept TEXT NOT NULL, -- e.g. "ISR Mensual", "Multa ERLC"
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'overdue'
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sat_tax_debts_user ON public.sat_tax_debts(user_id);
CREATE INDEX IF NOT EXISTS idx_sat_tax_debts_status ON public.sat_tax_debts(status);

-- 2. Tax Payment Logs (Historial de Pagos)
CREATE TABLE IF NOT EXISTS public.sat_payment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID REFERENCES public.sat_tax_debts(id),
    user_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT DEFAULT 'banxico_balance',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies (Optional but good practice)
ALTER TABLE public.sat_tax_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own debts" 
ON public.sat_tax_debts FOR SELECT 
USING (user_id = current_setting('request.jwt.claim.sub', true) OR user_id = 'public_view'); 
-- Note: 'public_view' is just a placeholder, in reality we might need proper auth or just disable RLS if using service key

-- Initial Seed Data for Testing
INSERT INTO public.sat_tax_debts (user_id, concept, amount, status, due_date)
VALUES 
    ('826637667718266880', 'ISR Periodo Enero 2026', 1250.00, 'pending', now() + interval '15 days'),
    ('826637667718266880', 'Tenencia Vehicular 2026', 850.00, 'overdue', now() - interval '5 days');
