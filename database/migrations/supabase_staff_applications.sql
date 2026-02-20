-- ========================================
-- SISTEMA DE POSTULACIONES DE STAFF
-- Supabase Schema
-- ========================================

-- 1. Tabla principal de postulaciones
CREATE TABLE IF NOT EXISTS staff_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Información del usuario
    discord_id TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_avatar TEXT,
    
    -- Vinculación de Roblox
    roblox_id TEXT,
    roblox_username TEXT,
    roblox_display_name TEXT,
    
    -- Respuestas del formulario
    age INTEGER,
    timezone TEXT,
    location TEXT, -- País/Ciudad
    experience TEXT, -- Experiencia previa en staff
    motivation TEXT, -- ¿Por qué quieres ser staff?
    availability TEXT, -- Horas disponibles por semana
    scenario_response TEXT, -- Respuesta a escenario hipotético
    additional_info TEXT, -- Información adicional
    
    -- Respuestas dinámicas (JSON para preguntas futuras)
    custom_answers JSONB DEFAULT '{}'::jsonb,
    
    -- Estado de la postulación
    status TEXT NOT NULL DEFAULT 'pending',
    -- pending, under_review, approved, rejected, withdrawn
    
    -- Revisión
    reviewed_by TEXT, -- Discord ID del staff que revisó
    reviewed_by_username TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT, -- Notas internas del staff
    reject_reason TEXT, -- Razón mostrada al usuario
    
    -- Cooldown y restricciones
    can_reapply_at TIMESTAMP WITH TIME ZONE,
    rejection_count INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT false, -- Si alcanzó 3 rechazos
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT, -- Para prevenir spam
    user_agent TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'withdrawn'))
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_applications_status ON staff_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_discord ON staff_applications(discord_id);
CREATE INDEX IF NOT EXISTS idx_applications_cooldown ON staff_applications(can_reapply_at) WHERE can_reapply_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_created ON staff_applications(created_at DESC);

-- 2. Tabla de preguntas dinámicas (opcional, para admin)
CREATE TABLE IF NOT EXISTS application_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_key TEXT UNIQUE NOT NULL, -- e.g., 'age', 'motivation'
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL, -- text, textarea, number, select, radio, checkbox
    placeholder TEXT,
    options JSONB, -- Para select/radio: ["Opción 1", "Opción 2"]
    validation_rules JSONB, -- min, max, required, pattern
    required BOOLEAN DEFAULT true,
    order_index INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_question_type CHECK (question_type IN ('text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'email', 'url'))
);

CREATE INDEX IF NOT EXISTS idx_questions_active ON application_questions(active, order_index);

-- 3. Tabla de comentarios/notas de staff (para evaluación colaborativa)
CREATE TABLE IF NOT EXISTS application_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES staff_applications(id) ON DELETE CASCADE,
    reviewer_discord_id TEXT NOT NULL,
    reviewer_username TEXT NOT NULL,
    rating INTEGER, -- 1-5 estrellas (opcional)
    comment TEXT,
    recommendation TEXT, -- 'approve', 'reject', 'needs_discussion'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT valid_recommendation CHECK (recommendation IN ('approve', 'reject', 'needs_discussion'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_application ON application_reviews(application_id);

-- 4. Tabla de logs de cambios (auditoría)
CREATE TABLE IF NOT EXISTS application_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES staff_applications(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'status_changed', 'reviewed', 'comment_added'
    actor_discord_id TEXT,
    actor_username TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_application ON application_logs(application_id, created_at DESC);

-- ========================================
-- FUNCIONES Y TRIGGERS
-- ========================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para staff_applications
DROP TRIGGER IF EXISTS update_staff_applications_updated_at ON staff_applications;
CREATE TRIGGER update_staff_applications_updated_at
    BEFORE UPDATE ON staff_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para application_questions
DROP TRIGGER IF EXISTS update_application_questions_updated_at ON application_questions;
CREATE TRIGGER update_application_questions_updated_at
    BEFORE UPDATE ON application_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para log automático de cambios
CREATE OR REPLACE FUNCTION log_application_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO application_logs (application_id, action, actor_discord_id, actor_username, new_value)
        VALUES (NEW.id, 'created', NEW.discord_id, NEW.discord_username, row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO application_logs (application_id, action, actor_discord_id, actor_username, old_value, new_value)
            VALUES (NEW.id, 'status_changed', NEW.reviewed_by, NEW.reviewed_by_username, 
                    json_build_object('status', OLD.status), 
                    json_build_object('status', NEW.status));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para log automático
DROP TRIGGER IF EXISTS log_application_changes_trigger ON staff_applications;
CREATE TRIGGER log_application_changes_trigger
    AFTER INSERT OR UPDATE ON staff_applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_changes();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS
ALTER TABLE staff_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios pueden ver sus propias postulaciones
CREATE POLICY "Users can view their own applications"
    ON staff_applications FOR SELECT
    USING (discord_id = auth.jwt() ->> 'sub');

-- Policy: Los usuarios pueden crear postulaciones
CREATE POLICY "Users can create applications"
    ON staff_applications FOR INSERT
    WITH CHECK (discord_id = auth.jwt() ->> 'sub');

-- Policy: Staff puede ver todas las postulaciones (necesitas configurar rol 'staff' en Supabase Auth)
CREATE POLICY "Staff can view all applications"
    ON staff_applications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'staff'
        )
    );

-- Policy: Preguntas visibles para todos
CREATE POLICY "Questions are public"
    ON application_questions FOR SELECT
    TO authenticated
    USING (active = true);

-- Policy: Solo staff puede modificar preguntas
CREATE POLICY "Staff can manage questions"
    ON application_questions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'staff'
        )
    );

-- ========================================
-- DATOS INICIALES (Preguntas predeterminadas)
-- ========================================

INSERT INTO application_questions (question_key, question_text, question_type, placeholder, validation_rules, required, order_index) VALUES
('age', '¿Cuántos años tienes?', 'number', 'Ej: 18', '{"min": 13, "max": 99}', true, 1),
('timezone', '¿En qué zona horaria te encuentras?', 'select', '', '{"options": ["GMT-8 (Pacífico)", "GMT-6 (Central)", "GMT-5 (Este)", "GMT-3 (Argentina)", "GMT+1 (Europa)"]}', true, 2),
('location', '¿En qué país/ciudad vives?', 'text', 'Ej: México, CDMX', '{"maxLength": 100}', true, 3),
('experience', 'Describe tu experiencia previa como staff (si aplica)', 'textarea', 'Experiencia en Discord, Roblox, etc.', '{"minLength": 50, "maxLength": 1000}', true, 4),
('motivation', '¿Por qué quieres ser parte del equipo de staff?', 'textarea', 'Explica tus motivaciones', '{"minLength": 100, "maxLength": 1000}', true, 5),
('availability', '¿Cuántas horas a la semana puedes dedicar al staff?', 'select', '', '{"options": ["1-5 horas", "5-10 horas", "10-20 horas", "20+ horas"]}', true, 6),
('scenario_response', 'Escenario: Un usuario está siendo tóxico en chat. ¿Cómo manejarías la situación?', 'textarea', 'Describe los pasos que tomarías', '{"minLength": 100, "maxLength": 500}', true, 7),
('additional_info', '¿Algo más que quieras añadir?', 'textarea', 'Información adicional (opcional)', '{"maxLength": 500}', false, 8)
ON CONFLICT (question_key) DO NOTHING;

-- ========================================
-- FUNCIONES DE UTILIDAD
-- ========================================

-- Función para verificar si un usuario puede postularse
CREATE OR REPLACE FUNCTION can_user_apply(user_discord_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    last_application RECORD;
BEGIN
    -- Check si está baneado
    SELECT is_banned INTO last_application
    FROM staff_applications
    WHERE discord_id = user_discord_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF last_application.is_banned THEN
        RETURN false;
    END IF;
    
    -- Check cooldown
    SELECT can_reapply_at INTO last_application
    FROM staff_applications
    WHERE discord_id = user_discord_id
      AND status = 'rejected'
      AND can_reapply_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        RETURN false;
    END IF;
    
    -- Check si ya tiene una postulación pendiente
    SELECT id INTO last_application
    FROM staff_applications
    WHERE discord_id = user_discord_id
      AND status IN ('pending', 'under_review')
    LIMIT 1;
    
    IF FOUND THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ========================================

COMMENT ON TABLE staff_applications IS 'Postulaciones de staff con información completa del usuario';
COMMENT ON TABLE application_questions IS 'Preguntas dinámicas configurables desde el panel admin';
COMMENT ON TABLE application_reviews IS 'Comentarios y evaluaciones de múltiples revisores';
COMMENT ON TABLE application_logs IS 'Log de auditoría de todos los cambios';

COMMENT ON COLUMN staff_applications.status IS 'Estado: pending, under_review, approved, rejected, withdrawn';
COMMENT ON COLUMN staff_applications.can_reapply_at IS 'Fecha en la que el usuario puede volver a postularse después de un rechazo';
COMMENT ON COLUMN staff_applications.is_banned IS 'true si alcanzó 3 rechazos permanentes';
