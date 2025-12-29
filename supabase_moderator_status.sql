-- ============================================
-- TABLA: moderator_status
-- Sistema de estado de moderadores activos
-- ============================================

CREATE TABLE IF NOT EXISTS moderator_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_toggle TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_moderator_status_user ON moderator_status(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_moderator_status_active ON moderator_status(is_active) WHERE is_active = true;

-- Comentarios
COMMENT ON TABLE moderator_status IS 'Estado activo/inactivo de moderadores para el comando /activo';
COMMENT ON COLUMN moderator_status.is_active IS 'true = aparece en /activo, false = oculto';

-- ============================================
-- TABLA: activo_embed_messages
-- Almacena el ID del mensaje permanente de /activo
-- ============================================

CREATE TABLE IF NOT EXISTS activo_embed_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Moderator status system created successfully!' AS status;
