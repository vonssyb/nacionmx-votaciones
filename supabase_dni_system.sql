    -- Sistema de DNI (Identificación Ciudadana)
    -- Stores citizen identification data for RP purposes

    CREATE TABLE IF NOT EXISTS public.citizen_dni (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Personal Information
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    edad INTEGER NOT NULL CHECK (edad >= 18 AND edad <= 99),
    fecha_nacimiento DATE,
    genero TEXT CHECK (genero IN ('Masculino', 'Femenino', 'Otro')),
    nacionalidad TEXT DEFAULT 'Mexicana',
    
    -- Optional
    foto_url TEXT, -- Profile photo for DNI
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL, -- Staff who created it
    last_edited_by TEXT, -- Staff who last edited
    
    UNIQUE(guild_id, user_id)
    );

    -- Index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_citizen_dni_user ON public.citizen_dni(guild_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_citizen_dni_nombre ON public.citizen_dni(nombre, apellido);

    -- Function to auto-update updated_at timestamp
    CREATE OR REPLACE FUNCTION update_dni_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger to auto-update timestamp
    DROP TRIGGER IF EXISTS trigger_update_dni_timestamp ON public.citizen_dni;
    CREATE TRIGGER trigger_update_dni_timestamp
    BEFORE UPDATE ON public.citizen_dni
    FOR EACH ROW
    EXECUTE FUNCTION update_dni_timestamp();

    COMMENT ON TABLE public.citizen_dni IS 'Citizen identification records for RP - integrates with banking and other systems';
    COMMENT ON COLUMN public.citizen_dni.edad IS 'Age - must be 18+ for RP rules';
    COMMENT ON COLUMN public.citizen_dni.foto_url IS 'Optional profile photo uploaded by staff';
