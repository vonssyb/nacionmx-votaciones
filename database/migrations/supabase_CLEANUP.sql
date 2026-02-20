-- LIMPIEZA FINAL: Borrar Código Maestro y Restaurar Seguridad
-- Ejecuta esto en el Editor SQL de Supabase

-- 1. Borrar el código de prueba permanentemente
DELETE FROM public.banxico_auth_codes WHERE code = '999999';

-- 2. Reactivar Seguridad (RLS) para proteger la tabla
ALTER TABLE public.banxico_auth_codes ENABLE ROW LEVEL SECURITY;

-- 3. Verificación (Debe salir vacío)
SELECT * FROM public.banxico_auth_codes WHERE code = '999999';
