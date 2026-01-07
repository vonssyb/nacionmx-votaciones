-- ============================================
-- SISTEMA COMPLETO DE EMPRESAS
-- Creación de tablas + permisos RLS
-- ============================================

-- ====================
-- 1. CREAR TABLAS
-- ====================

-- Tabla de empleados de empresa
CREATE TABLE IF NOT EXISTS company_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  citizen_name text,
  role text DEFAULT 'Empleado',
  salary numeric DEFAULT 0,
  hired_at timestamp with time zone DEFAULT now(),
  fired_at timestamp with time zone,
  UNIQUE(company_id, discord_id, fired_at)
);

-- Tabla de transacciones de empresa
CREATE TABLE IF NOT EXISTS company_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  type text CHECK (type IN ('income', 'expense', 'payroll', 'sale')) NOT NULL,
  amount numeric NOT NULL,
  description text,
  related_user_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_company_employees_active 
  ON company_employees(company_id, discord_id) 
  WHERE fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_transactions_date 
  ON company_transactions(company_id, created_at DESC);

-- ====================
-- 2. DESHABILITAR RLS (Recomendado para Service Role)
-- ====================

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_transactions DISABLE ROW LEVEL SECURITY;

-- ====================
-- 3. VERIFICACIÓN
-- ====================

-- Verificar que las tablas existan
SELECT 
    tablename, 
    CASE WHEN rowsecurity THEN 'Habilitado' ELSE 'Deshabilitado' END as rls_estado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('companies', 'company_employees', 'company_transactions')
ORDER BY tablename;

-- Contar registros
SELECT 
    'companies' as tabla, 
    COUNT(*) as registros 
FROM companies
UNION ALL
SELECT 
    'company_employees', 
    COUNT(*) 
FROM company_employees
UNION ALL
SELECT 
    'company_transactions', 
    COUNT(*) 
FROM company_transactions;

SELECT '✅ Sistema de Empresas instalado correctamente' as status;
