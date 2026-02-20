-- Tabla para tickets de McQueen Concesionario
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    ticket_type TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, closed, archived
    claimed_by TEXT, -- Staff member who claimed the ticket
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_channel_id ON tickets(channel_id);

-- Comentarios
COMMENT ON TABLE tickets IS 'Tickets del sistema McQueen Concesionario y otros sistemas de tickets';
COMMENT ON COLUMN tickets.ticket_type IS 'Tipo de ticket: Compra de Vehículo, Soporte Técnico, Agendar Cita, Recursos Humanos, etc.';
COMMENT ON COLUMN tickets.status IS 'Estado del ticket: open, closed, archived';
COMMENT ON COLUMN tickets.claimed_by IS 'ID del staff que reclamó el ticket';
