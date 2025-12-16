-- Create Fines Table
CREATE TABLE IF NOT EXISTS public.fines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    citizen_id UUID REFERENCES public.citizens(id) ON DELETE CASCADE,
    officer_discord_id VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'UNPAID' CHECK (status IN ('PAID', 'UNPAID')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (or authenticated)
CREATE POLICY "Enable read access for all users" ON public.fines FOR SELECT USING (true);

-- Allow insert/update for service role (Bot) or authenticated staff (if we add web UI later)
CREATE POLICY "Enable write access for authenticated users" ON public.fines FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Enable update access for authenticated users" ON public.fines FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
