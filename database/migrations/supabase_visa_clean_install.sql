-- Script de instalación limpia del sistema de visas
-- Ejecuta este archivo PRIMERO si ya ejecutaste el SQL anterior

-- Drop vistas (dependen de las tablas)
DROP VIEW IF EXISTS expiring_us_visas CASCADE;
DROP VIEW IF EXISTS pending_visa_requests CASCADE;
DROP VIEW IF EXISTS active_us_visas CASCADE;
DROP VIEW IF EXISTS all_citizens CASCADE;

-- Drop tablas (en orden de dependencias)
DROP TABLE IF EXISTS public.visa_requests CASCADE;
DROP TABLE IF EXISTS public.us_visas CASCADE;
DROP TABLE IF EXISTS public.american_id CASCADE;

-- Drop funciones
DROP FUNCTION IF EXISTS auto_expire_us_visas() CASCADE;
DROP FUNCTION IF EXISTS generate_us_visa_number() CASCADE;
DROP FUNCTION IF EXISTS update_visa_timestamp() CASCADE;

-- Ahora ejecuta supabase_visa_system.sql y supabase_american_id.sql
