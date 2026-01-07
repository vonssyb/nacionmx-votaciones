-- ============================================
-- MIGRACIÓN: Alinear company_employees con Legacy
-- ============================================

-- 1. Agregar columnas faltantes para compatibilidad con código modular
DO $$ 
BEGIN
    -- Agregar discord_id como alias de discord_user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_employees' 
        AND column_name = 'discord_id'
    ) THEN
        ALTER TABLE company_employees 
        ADD COLUMN discord_id text;
        
        -- Copiar datos existentes
        UPDATE company_employees 
        SET discord_id = discord_user_id 
        WHERE discord_id IS NULL;
    END IF;

    -- Agregar fired_at (fecha de despido)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_employees' 
        AND column_name = 'fired_at'
    ) THEN
        ALTER TABLE company_employees 
        ADD COLUMN fired_at timestamp with time zone;
    END IF;

    -- Agregar citizen_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_employees' 
        AND column_name = 'citizen_name'
    ) THEN
        ALTER TABLE company_employees 
        ADD COLUMN citizen_name text;
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
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'company_employees'
ORDER BY ordinal_position;

SELECT '✅ Migración completada. Verifica que discord_id, fired_at y citizen_name aparezcan arriba.' as status;
