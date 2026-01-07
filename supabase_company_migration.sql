-- ============================================
-- MIGRACIÓN: Completar Sistema de Empresas
-- ============================================

-- 1. Agregar columna faltante si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_employees' 
        AND column_name = 'fired_at'
    ) THEN
        ALTER TABLE company_employees 
        ADD COLUMN fired_at timestamp with time zone;
    END IF;
END $$;

-- 2. Crear tabla de transacciones si no existe
CREATE TABLE IF NOT EXISTS company_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  type text CHECK (type IN ('income', 'expense', 'payroll', 'sale')) NOT NULL,
  amount numeric NOT NULL,
  description text,
  related_user_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Crear índices
DROP INDEX IF EXISTS idx_company_employees_active;
CREATE INDEX idx_company_employees_active 
  ON company_employees(company_id, discord_id) 
  WHERE fired_at IS NULL;

DROP INDEX IF EXISTS idx_company_transactions_date;
CREATE INDEX IF NOT EXISTS idx_company_transactions_date 
  ON company_transactions(company_id, created_at DESC);

-- 4. Deshabilitar RLS
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_transactions DISABLE ROW LEVEL SECURITY;

-- 5. Verificación final
SELECT 
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_name = 'company_employees'
ORDER BY c.ordinal_position;

SELECT '✅ Migración completada. Verifica que "fired_at" aparezca arriba.' as status;
