-- Migración: Agregar sistema de fianza a la tabla arrests
-- Fecha: 2026-01-18

-- Agregar columnas para el sistema de fianza
ALTER TABLE arrests 
ADD COLUMN IF NOT EXISTS bail_allowed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bail_paid BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bail_amount INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bail_paid_at TIMESTAMPTZ DEFAULT NULL;

-- Comentarios sobre las columnas
COMMENT ON COLUMN arrests.bail_allowed IS 'Indica si este arresto permite pagar fianza (delitos graves = false)';
COMMENT ON COLUMN arrests.bail_paid IS 'NULL = no pagada, true = pagada, usada para filtrar arrestos activos';
COMMENT ON COLUMN arrests.bail_amount IS 'Monto pagado por la fianza (típicamente fine_amount * 2)';
COMMENT ON COLUMN arrests.bail_paid_at IS 'Fecha y hora en que se pagó la fianza';

-- Índice para búsquedas de arrestos activos (sin fianza pagada)
CREATE INDEX IF NOT EXISTS idx_arrests_bail_active ON arrests(user_id) WHERE bail_paid IS NULL;
