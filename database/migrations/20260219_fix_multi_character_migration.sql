-- FIX: Multi-Character Migration (Resolving FK Dependencies)
-- Date: 2026-02-19
-- Description: Safely modifies citizen_dni Primary Key/Unique constraints by handling dependent FKs from Visa tables.

BEGIN;

-- 1. Drop constraints CASCADE to handle dependencies (american_visas, us_visas, visa_applications)
-- This removes the FKs temporarily. We must restore them.
ALTER TABLE public.citizen_dni DROP CONSTRAINT IF EXISTS citizen_dni_pkey CASCADE;
ALTER TABLE public.citizen_dni DROP CONSTRAINT IF EXISTS citizen_dni_user_id_key CASCADE;

-- 2. Ensure columns exist
ALTER TABLE public.citizen_dni ADD COLUMN IF NOT EXISTS character_id integer DEFAULT 1 CHECK (character_id IN (1, 2));

-- 3. Set Primary Key
-- We prioritize using 'id' (UUID/Serial) as the Primary Key if it exists.
-- If 'id' does not exist, we fall back to composite (user_id, character_id).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citizen_dni' AND column_name = 'id') THEN
        ALTER TABLE public.citizen_dni ADD CONSTRAINT citizen_dni_pkey PRIMARY KEY (id);
    ELSE
        -- Fallback: If no ID column, add one? Or use composite?
        -- Safest is composite for now if no ID, but Visas reference ID.
        -- Assuming ID exists because of FK naming: citizen_dni_id_fkey
        ALTER TABLE public.citizen_dni ADD CONSTRAINT citizen_dni_pkey PRIMARY KEY (user_id, character_id);
    END IF;
END $$;

-- 4. Add Unique Consraint for (user_id, character_id) to prevent duplicates per slot
-- This allows: User A - Char 1, User A - Char 2.
ALTER TABLE public.citizen_dni ADD CONSTRAINT citizen_dni_user_character_unique UNIQUE (user_id, character_id);

-- 5. Restore Foreign Keys
-- We assume the visa tables reference 'citizen_dni(id)' via a column named 'citizen_dni_id'.
DO $$
BEGIN
    -- american_visas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'american_visas') THEN
        -- Check if column exists before adding FK
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'american_visas' AND column_name = 'citizen_dni_id') THEN
            ALTER TABLE public.american_visas 
            ADD CONSTRAINT american_visas_citizen_dni_id_fkey 
            FOREIGN KEY (citizen_dni_id) REFERENCES public.citizen_dni(id);
        END IF;
    END IF;

    -- us_visas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'us_visas') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'us_visas' AND column_name = 'citizen_dni_id') THEN
            ALTER TABLE public.us_visas 
            ADD CONSTRAINT us_visas_citizen_dni_id_fkey 
            FOREIGN KEY (citizen_dni_id) REFERENCES public.citizen_dni(id);
        END IF;
    END IF;

    -- visa_applications
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visa_applications') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visa_applications' AND column_name = 'citizen_dni_id') THEN
            ALTER TABLE public.visa_applications 
            ADD CONSTRAINT visa_applications_citizen_dni_id_fkey 
            FOREIGN KEY (citizen_dni_id) REFERENCES public.citizen_dni(id);
        END IF;
    END IF;

END $$;

-- 6. Helper Function (Idempotent)
CREATE OR REPLACE FUNCTION get_active_character(target_user_id text)
RETURNS integer AS $$
DECLARE
    char_id integer;
BEGIN
    SELECT active_character_id INTO char_id
    FROM public.user_active_character
    WHERE user_id = target_user_id;
    
    RETURN COALESCE(char_id, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
