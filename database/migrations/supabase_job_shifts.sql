-- Sistema de Turnos de Trabajo (Economy Bot)
-- Ciudadanos fichan entrada/salida para registrar horas

CREATE TABLE IF NOT EXISTS public.job_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL, -- Discord ID
    full_name TEXT, -- Nombre del ciudadano (vía vincular)
    
    clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clock_out TIMESTAMPTZ,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    
    duration_minutes INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_job_shifts_user ON public.job_shifts(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_job_shifts_status ON public.job_shifts(status);

-- Función para cerrar turnos olvidados (Opcional, manual por ahora)
COMMENT ON TABLE public.job_shifts IS 'Registro de turnos de trabajo para ciudadanos de Nación MX';
