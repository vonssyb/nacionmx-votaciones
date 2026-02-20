-- FIX: Tabla debit_cards completa con todas las columnas
-- Ejecutar en Supabase SQL Editor

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS debit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT NOT NULL,
    citizen_id UUID,
    card_number TEXT NOT NULL UNIQUE,
    card_tier TEXT DEFAULT 'NMX Débito',
    balance BIGINT DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar columnas si faltan (por si acaso)
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS card_tier TEXT DEFAULT 'NMX Débito';
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 0;
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_debit_cards_discord_user ON debit_cards(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_debit_cards_status ON debit_cards(status);
CREATE INDEX IF NOT EXISTS idx_debit_cards_discord_status ON debit_cards(discord_user_id, status);

-- Actualizar tarjetas existentes sin tier
UPDATE debit_cards 
SET card_tier = 'NMX Débito' 
WHERE card_tier IS NULL;

-- Actualizar tarjetas existentes sin status
UPDATE debit_cards 
SET status = 'active' 
WHERE status IS NULL;

-- ===== ROW LEVEL SECURITY (RLS) =====
-- IMPORTANTE: Verificar que RLS está configurado correctamente

-- Habilitar RLS
ALTER TABLE debit_cards ENABLE ROW LEVEL SECURITY;

-- Política para SERVICE ROLE (el bot)
-- Permite que el bot lea/escriba TODO
DO $$
BEGIN
    -- Eliminar políticas existentes si existen
    DROP POLICY IF EXISTS "Service role can do everything" ON debit_cards;
    
    -- Crear política que permite TODO al service role
    CREATE POLICY "Service role can do everything" 
    ON debit_cards 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignorar si ya existe
END $$;

-- Verificación: Mostrar estructura de tabla
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'debit_cards'
ORDER BY ordinal_position;

-- Mostrar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'debit_cards';
