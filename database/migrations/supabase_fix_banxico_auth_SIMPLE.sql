-- FIX SIMPLE: Solo insertar el código de prueba (ignorando tablas/políticas)
-- Ejecutar en Supabase SQL Editor

-- Insert TEST CODE 999999
DELETE FROM public.banxico_auth_codes WHERE code = '999999';

INSERT INTO public.banxico_auth_codes (user_id, code, expires_at)
VALUES ('826637667718266880', '999999', now() + interval '1 day');
