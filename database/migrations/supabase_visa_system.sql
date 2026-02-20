-- Sistema de Visas USA para Ciudadanos Mexicanos
-- Mexicanos solicitan visa → Staff aprueba → Obtienen rol americano

-- Tabla principal: Visas USA otorgadas
CREATE TABLE IF NOT EXISTS public.us_visas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL, -- Discord ID del ciudadano mexicano
    citizen_dni_id INTEGER REFERENCES public.citizen_dni(id) ON DELETE CASCADE,
    
    -- Información de Visa
    visa_type TEXT NOT NULL CHECK (visa_type IN ('turista', 'trabajo', 'estudiante', 'residente')),
    visa_number TEXT UNIQUE NOT NULL, -- Formato: USA-XXXX-YYYY
    
    -- Fechas
    issued_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiration_date TIMESTAMPTZ, -- NULL para "residente" (permanente)
    
    -- Estado
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    
    -- Auditoría
    approved_by TEXT NOT NULL, -- Staff que aprobó la visa
    approved_by_tag TEXT,
    revoked_by TEXT,
    revoked_reason TEXT,
    revoked_at TIMESTAMPTZ,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Solo una visa activa por usuario
    UNIQUE(guild_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_us_visas_user ON public.us_visas(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_us_visas_status ON public.us_visas(status);
CREATE INDEX IF NOT EXISTS idx_us_visas_expiration ON public.us_visas(expiration_date) WHERE status = 'active';

-- Tabla de solicitudes pendientes
CREATE TABLE IF NOT EXISTS public.visa_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_tag TEXT NOT NULL,
    citizen_dni_id INTEGER REFERENCES public.citizen_dni(id),
    
    -- Solicitud
    visa_type TEXT NOT NULL CHECK (visa_type IN ('turista', 'trabajo', 'estudiante', 'residente')),
    reason TEXT, -- Por qué solicita la visa
    
    -- Estado y revisión
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_by_tag TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para solicitudes
CREATE INDEX IF NOT EXISTS idx_visa_requests_user ON public.visa_requests(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_visa_requests_status ON public.visa_requests(status);

-- Función: Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_visa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trigger_update_us_visa_timestamp ON public.us_visas;
CREATE TRIGGER trigger_update_us_visa_timestamp
    BEFORE UPDATE ON public.us_visas
    FOR EACH ROW
    EXECUTE FUNCTION update_visa_timestamp();

DROP TRIGGER IF EXISTS trigger_update_visa_request_timestamp ON public.visa_requests;
CREATE TRIGGER trigger_update_visa_request_timestamp
    BEFORE UPDATE ON public.visa_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_visa_timestamp();

-- Función: Generar número de visa único
CREATE OR REPLACE FUNCTION generate_us_visa_number()
RETURNS TEXT AS $$
DECLARE
    visa_num TEXT;
    exists_check INTEGER;
BEGIN
    LOOP
        -- Formato: USA-XXXX-YYYY
        visa_num := 'USA-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0') || '-' || EXTRACT(YEAR FROM NOW())::TEXT;
        
        SELECT COUNT(*) INTO exists_check
        FROM public.us_visas
        WHERE visa_number = visa_num;
        
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN visa_num;
END;
$$ LANGUAGE plpgsql;

-- Función: Auto-expirar visas
CREATE OR REPLACE FUNCTION auto_expire_us_visas()
RETURNS TABLE(user_id TEXT, visa_number TEXT) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.us_visas
    SET status = 'expired'
    WHERE status = 'active'
    AND expiration_date IS NOT NULL
    AND expiration_date < NOW()
    RETURNING us_visas.user_id, us_visas.visa_number;
END;
$$ LANGUAGE plpgsql;

-- Vistas útiles
CREATE OR REPLACE VIEW active_us_visas AS
SELECT 
    v.*,
    d.nombre,
    d.apellido,
    CASE 
        WHEN v.expiration_date IS NULL THEN 'Permanente'
        ELSE (v.expiration_date - NOW())::TEXT
    END as time_remaining
FROM public.us_visas v
LEFT JOIN public.citizen_dni d ON v.citizen_dni_id = d.id
WHERE v.status = 'active';

CREATE OR REPLACE VIEW pending_visa_requests AS
SELECT 
    vr.*,
    d.nombre,
    d.apellido
FROM public.visa_requests vr
LEFT JOIN public.citizen_dni d ON vr.citizen_dni_id = d.id
WHERE vr.status = 'pending'
ORDER BY vr.created_at ASC;

CREATE OR REPLACE VIEW expiring_us_visas AS
SELECT 
    v.*,
    d.nombre,
    d.apellido,
    (v.expiration_date - NOW()) as time_remaining
FROM public.us_visas v
LEFT JOIN public.citizen_dni d ON v.citizen_dni_id = d.id
WHERE v.status = 'active'
AND v.expiration_date IS NOT NULL
AND v.expiration_date > NOW()
AND v.expiration_date < (NOW() + INTERVAL '7 days')
ORDER BY v.expiration_date ASC;

-- Comentarios
COMMENT ON TABLE public.us_visas IS 'US Visas for Mexican citizens - grants American role when approved';
COMMENT ON TABLE public.visa_requests IS 'Pending visa applications awaiting staff approval';
COMMENT ON COLUMN public.us_visas.visa_type IS 'turista(90d), trabajo(180d), estudiante(365d), residente(permanent)';
COMMENT ON COLUMN public.us_visas.expiration_date IS 'NULL = permanent (residente), otherwise auto-expires and removes American role';
