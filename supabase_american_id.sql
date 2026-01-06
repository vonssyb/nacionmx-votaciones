-- Sistema de Identificación para Ciudadanos Americanos
-- Para usuarios que YA tienen el rol americano (nacidos americanos)
-- Similar al DNI mexicano pero para americanos

CREATE TABLE IF NOT EXISTS public.american_id (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Personal Information
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18 AND age <= 99),
    birth_date DATE,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    
    -- American ID Info
    ssn_last4 TEXT CHECK (LENGTH(ssn_last4) = 4), -- Últimos 4 dígitos SSN (seguridad)
    state TEXT, -- Estado de residencia (California, Texas, etc)
    
    -- Optional
    photo_url TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL,
    last_edited_by TEXT,
    
    UNIQUE(guild_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_american_id_user ON public.american_id(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_american_id_name ON public.american_id(first_name, last_name);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_american_id_timestamp ON public.american_id;
CREATE TRIGGER trigger_update_american_id_timestamp
    BEFORE UPDATE ON public.american_id
    FOR EACH ROW
    EXECUTE FUNCTION update_dni_timestamp(); -- Reutilizamos la función existente

-- Comentarios
COMMENT ON TABLE public.american_id IS 'American citizen identification - for users with American role (born Americans, not visa holders)';
COMMENT ON COLUMN public.american_id.ssn_last4 IS 'Last 4 digits of SSN for RP purposes (security)';
COMMENT ON COLUMN public.american_id.state IS 'US State of residence';

-- Vista combinada: Todos los ciudadanos (mexicanos + americanos)
CREATE OR REPLACE VIEW all_citizens AS
SELECT 
    'mexican' as citizenship,
    id,
    guild_id,
    user_id,
    nombre as first_name,
    apellido as last_name,
    edad as age,
    genero as gender,
    created_at
FROM public.citizen_dni
UNION ALL
SELECT 
    'american' as citizenship,
    id,
    guild_id,
    user_id,
    first_name,
    last_name,
    age,
    gender,
    created_at
FROM public.american_id;
