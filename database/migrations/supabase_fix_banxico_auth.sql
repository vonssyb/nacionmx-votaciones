-- FIX: Asegurar que tabla banxico_auth_codes existe
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.banxico_auth_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_banxico_auth_code ON banxico_auth_codes(code);
CREATE INDEX IF NOT EXISTS idx_banxico_auth_user ON banxico_auth_codes(user_id);

-- RLS
ALTER TABLE public.banxico_auth_codes ENABLE ROW LEVEL SECURITY;

-- Policy (Service Role Bypass usually handles this, but adding public read for debug if needed)
CREATE POLICY "Bot Full Access" ON public.banxico_auth_codes FOR ALL USING (true);

-- Insert TEST CODE 999999
-- User ID: 826637667718266880 (Bot Owner)
DELETE FROM public.banxico_auth_codes WHERE code = '999999';
INSERT INTO public.banxico_auth_codes (user_id, code, expires_at)
VALUES ('826637667718266880', '999999', now() + interval '1 day');
