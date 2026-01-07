-- ============================================
-- DIAGNÓSTICO: Verificar Empleados de Empresa
-- ============================================

-- 1. Ver TODAS las empresas registradas
SELECT 
    id,
    name as empresa,
    owner_ids as dueños_discord,
    balance,
    created_at
FROM companies
ORDER BY created_at DESC;

-- 2. Ver TODOS los empleados con detalles completos
SELECT 
    ce.id,
    c.name as empresa,
    ce.discord_id as discord_id_modular,
    ce.discord_user_id as discord_user_id_legacy,
    ce.citizen_name as nombre,
    ce.role as cargo,
    ce.salary as salario,
    ce.status as estado_legacy,
    ce.fired_at as despedido_en,
    CASE 
        WHEN ce.fired_at IS NULL AND ce.status = 'active' THEN '✅ ACTIVO'
        WHEN ce.fired_at IS NOT NULL THEN '❌ DESPEDIDO'
        WHEN ce.status != 'active' THEN '⚠️ INACTIVO'
        ELSE '❓ DESCONOCIDO'
    END as estado_real,
    ce.hired_at as contratado_en
FROM company_employees ce
JOIN companies c ON c.id = ce.company_id
ORDER BY ce.hired_at DESC;

-- 3. Verificar empleados ACTIVOS (como los busca el bot)
SELECT 
    c.name as empresa,
    ce.discord_id,
    ce.citizen_name,
    ce.role,
    ce.salary
FROM company_employees ce
JOIN companies c ON c.id = ce.company_id
WHERE ce.fired_at IS NULL
  AND ce.discord_id IS NOT NULL
ORDER BY ce.hired_at DESC;

-- 4. Contar registros
SELECT 
    COUNT(*) as total_empresas
FROM companies;

SELECT 
    COUNT(*) as total_empleados,
    COUNT(CASE WHEN discord_id IS NOT NULL THEN 1 END) as con_discord_id,
    COUNT(CASE WHEN fired_at IS NULL THEN 1 END) as activos
FROM company_employees;

-- 5. INSTRUCCIONES
SELECT '
🔍 CÓMO INTERPRETAR:
1. Verifica que tu empresa aparezca en la primera query
2. Busca tu Discord ID (números largos) en la segunda query
3. Si apareces en la query 2 pero NO en la query 3, tu discord_id está NULL
4. Si no apareces en absoluto, necesitas ser contratado de nuevo

💡 SOLUCIONES:
- Si discord_id está NULL: Ejecuta supabase_sync_company_employees.sql
- Si no apareces: Pide al dueño que ejecute /empresa contratar de nuevo
' as ayuda;
