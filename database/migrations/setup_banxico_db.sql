-- Banxico & SAT Services Setup Script
-- Run this in your Supabase SQL Editor to enable all features

-- 1. Create SAT Tax Debts Table
CREATE TABLE IF NOT EXISTS public.sat_tax_debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    concept TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'overdue'
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create SAT Payment Logs
CREATE TABLE IF NOT EXISTS public.sat_payment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID REFERENCES public.sat_tax_debts(id),
    user_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method TEXT DEFAULT 'banxico_balance',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create Banxico Logs (for generic auditing)
CREATE TABLE IF NOT EXISTS public.banxico_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    details JSONB,
    executor_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create Economy Transactions (if not exists)
CREATE TABLE IF NOT EXISTS public.economy_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id TEXT,
    receiver_id TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Enable RLS (Security)
ALTER TABLE public.sat_tax_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sat_payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banxico_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Basic Policies (Adjust as needed)
CREATE POLICY "Public Read" ON public.sat_tax_debts FOR SELECT USING (true);
CREATE POLICY "Bot Write" ON public.sat_tax_debts FOR ALL USING (true);
CREATE POLICY "Public Read Logs" ON public.banxico_logs FOR SELECT USING (true);

-- 7. Insert Dummy Data for Testing
INSERT INTO public.sat_tax_debts (user_id, concept, amount, status, due_date)
VALUES 
    ('826637667718266880', 'ISR Enero 2026', 1500.00, 'pending', now() + interval '5 days'),
    ('826637667718266880', 'Multa de Tránsito', 500.00, 'pending', now() + interval '10 days')
ON CONFLICT DO NOTHING;
