-- Create us_visas table for US Visa system
CREATE TABLE IF NOT EXISTS us_visas (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    citizen_dni_id BIGINT REFERENCES citizen_dni(id) ON DELETE CASCADE,
    visa_type TEXT NOT NULL CHECK (visa_type IN ('turista', 'trabajo', 'estudiante', 'residente')),
    visa_number TEXT UNIQUE NOT NULL,
    expiration_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    approved_by TEXT,
    approved_by_tag TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, user_id, visa_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_us_visas_user ON us_visas(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_us_visas_status ON us_visas(status);

-- Create visa_applications table
CREATE TABLE IF NOT EXISTS visa_applications (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    citizen_dni_id BIGINT REFERENCES citizen_dni(id) ON DELETE CASCADE,
    visa_type TEXT NOT NULL CHECK (visa_type IN ('turista', 'trabajo', 'estudiante', 'residente')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_by_tag TEXT,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_visa_applications_status ON visa_applications(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_visa_applications_user ON visa_applications(user_id);

-- Function to generate US visa number
CREATE OR REPLACE FUNCTION generate_us_visa_number()
RETURNS TEXT AS $$
DECLARE
    visa_num TEXT;
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Format: USA-XXXXXXXX (8 random digits)
        visa_num := 'USA-' || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
        
        -- Check if it exists
        SELECT EXISTS(SELECT 1 FROM us_visas WHERE visa_number = visa_num) INTO exists_check;
        
        -- If unique, return it
        IF NOT exists_check THEN
            RETURN visa_num;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE us_visas IS 'Stores active US visas for citizens';
COMMENT ON TABLE visa_applications IS 'Stores visa applications for USCIS review';
