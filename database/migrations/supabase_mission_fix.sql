-- ============================================
-- FIX COMPLETO: TABLAS DE MISIONES Y TRACKING
-- Ejecutar esto para reparar el error "relation does not exist"
-- ============================================

-- 1. Tabla: Daily Missions
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

-- 2. Tabla: Mission Completions (Con Tracking)
CREATE TABLE IF NOT EXISTS mission_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES daily_missions(id) ON DELETE CASCADE,
  discord_id text NOT NULL,
  completed_at timestamp with time zone,
  claimed boolean DEFAULT false,
  claimed_at timestamp with time zone,
  
  -- Tracking Columns
  progress_current numeric DEFAULT 0,
  progress_target numeric DEFAULT 1,
  last_update timestamp with time zone DEFAULT now(),

  UNIQUE(mission_id, discord_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_daily_missions_active 
  ON daily_missions(active_date DESC);

CREATE INDEX IF NOT EXISTS idx_mission_completions_progress 
  ON mission_completions(discord_id, mission_id);

-- 4. Seed Data (Ejemplos)
INSERT INTO daily_missions (title, description, reward_money, reward_xp, requirements, difficulty, active_date)
VALUES 
  ('Patrullaje Preventivo', 'Realiza un patrullaje de al menos 30 minutos.', 5000, 100, '{"type":"shift_minutes","count":30}', 'easy', CURRENT_DATE)
ON CONFLICT DO NOTHING;

SELECT 'Tablas de misiones reparadas exitosamente' as status;
