-- ============================================
-- FIX: RLS Policies for Company System
-- Solución para errores de permisos en /empresa
-- ============================================

-- Opción 1: Deshabilitar RLS (Simple, menos seguro)
-- Usa esto si tu bot usa SERVICE_ROLE_KEY (bypasea RLS de todos modos)
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_transactions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Opción 2: Habilitar RLS con políticas permisivas
-- Usa esto si necesitas RLS activo por otras razones
-- ============================================

-- Primero, asegúrate de que RLS esté habilitado
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_transactions ENABLE ROW LEVEL SECURITY;

-- Política: Permitir todas las operaciones al service_role
CREATE POLICY "Service role bypass for companies" 
ON companies 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role bypass for company_employees" 
ON company_employees 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role bypass for company_transactions" 
ON company_transactions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ============================================
-- Verificación
-- ============================================

-- Verifica el estado de RLS
SELECT tablename, 
       rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'company_employees', 'company_transactions');

-- Verifica las políticas activas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('companies', 'company_employees', 'company_transactions');
