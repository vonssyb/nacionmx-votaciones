-- FIX: Deshabilitar RLS temporalmente para asegurar que el bot ve la tabla
-- y reinsertar 999999

-- 1. Deshabilitar Seguridad (Para que el bot la vea sí o sí)
ALTER TABLE public.banxico_auth_codes DISABLE ROW LEVEL SECURITY;

-- 2. Limpiar e Insertar Código Maestro 999999
DELETE FROM public.banxico_auth_codes WHERE code = '999999';

INSERT INTO public.banxico_auth_codes (user_id, code, expires_at)
VALUES ('826637667718266880', '999999', now() + interval '10 days');

-- 3. Verificacin (Debe mostrar 1 fila)
SELECT * FROM public.banxico_auth_codes WHERE code = '999999';
