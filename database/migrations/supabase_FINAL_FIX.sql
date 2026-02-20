-- PASO FINAL: Arreglar Permisos y Crear Código 999999
-- Ejecuta esto en el Editor SQL de Supabase (PROYECTO: igjedwd...)

-- 1. Asegurar tabla
CREATE TABLE IF NOT EXISTS public.banxico_auth_codes (
    code text PRIMARY KEY,
    user_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL
);

-- 2. DESACTIVAR SEGURIDAD (RLS) TEMPORALMENTE
-- Esto permite que el bot lea la tabla sin problemas de policies
ALTER TABLE public.banxico_auth_codes DISABLE ROW LEVEL SECURITY;

-- 3. ELIMINAR CÓDIGO VIEJO
DELETE FROM public.banxico_auth_codes WHERE code = '999999';

-- 4. INSERTAR CÓDIGO NUEVO (Válido por 30 días)
INSERT INTO public.banxico_auth_codes (code, user_id, expires_at)
VALUES ('999999', '826637667718266880', now() + interval '30 days');

-- 5. VERIFICACIÓN (Debe salir 1 fila abajo)
SELECT * FROM public.banxico_auth_codes WHERE code = '999999';
