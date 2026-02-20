-- ============================================
-- NUEVAS CARACTERÍSTICAS - FIANZA, EMPRESA, MISIONES, REPUTACIÓN
-- Base de Datos Supabase para Nación MX
-- ============================================

-- ====================
-- SISTEMA DE FIANZA
-- ====================

-- Agregar campos de fianza a tabla arrests
ALTER TABLE arrests 
  ADD COLUMN IF NOT EXISTS bail_allowed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS bail_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bail_paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bail_paid_at timestamp with time zone;

-- ====================
-- EXPANSIÓN DE EMPRESA
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
  UNIQUE(company_id, discord_id, fired_at) -- Permite re-contratar
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
-- SISTEMA DE MISIONES DIARIAS
-- ====================

CREATE TABLE IF NOT EXISTS daily_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_money numeric DEFAULT 0,
  reward_xp integer DEFAULT 0,
  requirements jsonb, -- { "type": "work", "count": 3 }
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
  active_date date DEFAULT CURRENT_DATE,
  created_by text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mission_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES daily_missions(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  claimed boolean DEFAULT false,
  claimed_at timestamp with time zone,
  UNIQUE(mission_id, discord_id)
);

-- Índice para misiones activas
CREATE INDEX IF NOT EXISTS idx_daily_missions_active 
  ON daily_missions(active_date DESC) 
  WHERE active_date >= CURRENT_DATE;

-- ====================
-- SISTEMA DE REPUTACIÓN
-- ====================

CREATE TABLE IF NOT EXISTS reputation_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_discord_id text NOT NULL,
  giver_discord_id text NOT NULL,
  points integer DEFAULT 1 CHECK (points >= -5 AND points <= 5),
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(target_discord_id, giver_discord_id)
);

-- Vista para rankings
CREATE OR REPLACE VIEW reputation_rankings AS
SELECT 
  target_discord_id,
  SUM(points) as total_reputation,
  COUNT(*) as vote_count,
  COUNT(CASE WHEN points > 0 THEN 1 END) as positive_votes,
  COUNT(CASE WHEN points < 0 THEN 1 END) as negative_votes,
  AVG(points)::numeric(10,2) as avg_score
FROM reputation_points
GROUP BY target_discord_id
ORDER BY total_reputation DESC;

-- Índices
CREATE INDEX IF NOT EXISTS idx_reputation_target 
  ON reputation_points(target_discord_id, points);

CREATE INDEX IF NOT EXISTS idx_reputation_giver 
  ON reputation_points(giver_discord_id, created_at DESC);

-- ====================
-- SEED DATA: Misiones de Ejemplo
-- ====================

INSERT INTO daily_missions (title, description, reward_money, reward_xp, requirements, difficulty, active_date)
VALUES 
  ('Día de Trabajo', 'Completa 3 trabajos legales usando /trabajar', 5000, 100, '{"type":"work","count":3}', 'easy', CURRENT_DATE),
  ('Inversionista Activo', 'Realiza una inversión en la bolsa de valores', 3000, 75, '{"type":"stock","count":1}', 'easy', CURRENT_DATE + 1),
  ('Ciudadano Responsable', 'Paga tu tarjeta de crédito completamente', 10000, 150, '{"type":"credit_payment","count":1}', 'medium', CURRENT_DATE + 2)
ON CONFLICT DO NOTHING;

-- ====================
-- VERIFICACIÓN
-- ====================

SELECT 'Nuevas tablas y características creadas exitosamente!' AS status;
