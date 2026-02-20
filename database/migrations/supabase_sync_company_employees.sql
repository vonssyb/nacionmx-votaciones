-- ============================================
-- SINCRONIZACIÓN: Empleados Legacy → Modular
-- ============================================

-- Actualizar empleados existentes para que funcionen con código modular
UPDATE company_employees
SET 
    discord_id = discord_user_id
WHERE discord_id IS NULL 
  AND discord_user_id IS NOT NULL;

-- Verificar sincronización
SELECT 
    id,
    company_id,
    discord_user_id as legacy_id,
    discord_id as modular_id,
    status as legacy_status,
    fired_at as modular_fired,
    role,
    salary,
    hired_at
FROM company_employees
ORDER BY hired_at DESC
LIMIT 10;

SELECT 
    COUNT(*) as total_empleados,
    COUNT(discord_id) as con_discord_id,
    COUNT(discord_user_id) as con_discord_user_id,
    COUNT(CASE WHEN status = 'active' AND fired_at IS NULL THEN 1 END) as activos
FROM company_employees;

SELECT '✅ Empleados sincronizados. Reinicia el bot y prueba /empresa cobrar' as status;
