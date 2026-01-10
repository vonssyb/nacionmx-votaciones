-- ============================================================================
-- FASE 1: Sistema de Doble Moneda (MXN/USD) - Migraciones SQL
-- ============================================================================

-- 1. Agregar columnas USD a user_stats
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS usd_cash BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_rate_cache NUMERIC(10,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS last_exchange_date TIMESTAMPTZ;

COMMENT ON COLUMN user_stats.usd_cash IS 'USD en efectivo - solo se puede tener en cash (no banco)';
COMMENT ON COLUMN user_stats.exchange_rate_cache IS 'Última tasa de cambio vista por el usuario';
COMMENT ON COLUMN user_stats.last_exchange_date IS 'Última vez que consultó/usó tasa de cambio';

-- 2. Crear tabla de tasas de cambio (historial)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    rate NUMERIC(10,2) NOT NULL CHECK (rate > 0), -- 1 USD = X MXN
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    set_by TEXT, -- Admin que configuró la tasa (si fue manual)
    is_manual BOOLEAN DEFAULT false, -- true si admin lo configuró
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar tasa inicial
INSERT INTO exchange_rates (rate, date, is_manual) 
VALUES (18.50, CURRENT_DATE, false)
ON CONFLICT (date) DO NOTHING;

COMMENT ON TABLE exchange_rates IS 'Historial de tasas de cambio USD/MXN (actualización diaria)';

-- 3. Crear tabla de tarjetas de crédito americanas (USD)
CREATE TABLE IF NOT EXISTS us_credit_cards (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    card_number TEXT UNIQUE NOT NULL,
    card_type TEXT NOT NULL CHECK (card_type IN ('Visa', 'Mastercard', 'Amex')),
    credit_limit BIGINT NOT NULL CHECK (credit_limit > 0),
    current_balance BIGINT DEFAULT 0 CHECK (current_balance >= 0),
    available_credit BIGINT GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
    monthly_interest_rate NUMERIC(5,2) DEFAULT 3.00, -- 3% mensual
    last_payment_date TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ,
    minimum_payment BIGINT DEFAULT 0,
    issued_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'frozen', 'cancelled')),
    approved_by TEXT, -- Admin que aprobó
    approval_ticket_id BIGINT, -- ID del ticket de aprobación
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_number)
);

CREATE INDEX IF NOT EXISTS idx_us_credit_cards_user ON us_credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_us_credit_cards_status ON us_credit_cards(status);

COMMENT ON TABLE us_credit_cards IS 'Tarjetas de crédito americanas (USD) - requieren visa activa y aprobación por ticket';

-- 4. Crear tabla de transacciones de cambio de moneda
CREATE TABLE IF NOT EXISTS currency_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_currency TEXT NOT NULL CHECK (from_currency IN ('MXN', 'USD')),
    to_currency TEXT NOT NULL CHECK (to_currency IN ('MXN', 'USD')),
    from_amount BIGINT NOT NULL CHECK (from_amount > 0),
    to_amount BIGINT NOT NULL CHECK (to_amount > 0),
    exchange_rate NUMERIC(10,2) NOT NULL,
    fee_percentage NUMERIC(5,2) DEFAULT 2.5,
    fee_amount BIGINT DEFAULT 0,
    location_type TEXT CHECK (location_type IN ('casa_cambio', 'usa')), -- Dónde se hizo el cambio
    location_id BIGINT, -- ID de la casa de cambio (si aplica)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_user ON currency_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_date ON currency_transactions(created_at DESC);

COMMENT ON TABLE currency_transactions IS 'Historial de cambios de moneda MXN <-> USD';

-- 5. Crear tabla de casas de cambio
CREATE TABLE IF NOT EXISTS currency_exchange_locations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL, -- 'CDMX', 'Guadalajara', etc.
    fee_percentage NUMERIC(5,2) DEFAULT 2.5 CHECK (fee_percentage >= 0),
    daily_limit_usd BIGINT DEFAULT 10000, -- Límite diario de cambio
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar casas de cambio iniciales
INSERT INTO currency_exchange_locations (name, location, fee_percentage, daily_limit_usd) VALUES
('Casa de Cambio Central', 'CDMX', 2.5, 10000),
('Exchange Plaza', 'Guadalajara', 3.0, 8000),
('Cambio Express', 'Monterrey', 2.0, 12000)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE currency_exchange_locations IS 'Ubicaciones de casas de cambio disponibles';

-- 6. Actualizar tabla us_visas para expiración y renovación
ALTER TABLE us_visas
ADD COLUMN IF NOT EXISTS renewable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS renewal_cost BIGINT,
ADD COLUMN IF NOT EXISTS times_renewed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS issued_by_company BIGINT, -- ID de empresa que emitió visa de trabajo
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

COMMENT ON COLUMN us_visas.renewable IS 'Si la visa puede ser renovada (false si expiró sin renovar)';
COMMENT ON COLUMN us_visas.renewal_cost IS 'Costo de renovación (mismo que costo original)';
COMMENT ON COLUMN us_visas.times_renewed IS 'Cuántas veces se ha renovado';
COMMENT ON COLUMN us_visas.issued_by_company IS 'ID de empresa que emitió visa de trabajo (si aplica)';

-- 7. Función para obtener tasa de cambio actual
CREATE OR REPLACE FUNCTION get_current_exchange_rate()
RETURNS NUMERIC(10,2) AS $$
DECLARE
    current_rate NUMERIC(10,2);
BEGIN
    SELECT rate INTO current_rate
    FROM exchange_rates
    WHERE date <= CURRENT_DATE
    ORDER BY date DESC
    LIMIT 1;
    
    -- Si no hay tasa, usar default
    IF current_rate IS NULL THEN
        current_rate := 18.50;
    END IF;
    
    RETURN current_rate;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_exchange_rate IS 'Obtiene la tasa de cambio más reciente';

-- 8. Función para calcular fecha de expiración de visa
CREATE OR REPLACE FUNCTION calculate_visa_expiration(visa_type TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    CASE visa_type
        WHEN 'residente' THEN
            RETURN NULL; -- Ciudadanía/Green Card es indefinida
        WHEN 'turista', 'trabajo', 'estudiante' THEN
            RETURN NOW() + INTERVAL '30 days'; -- 1 mes para todas las demás
        ELSE
            RETURN NOW() + INTERVAL '30 days'; -- Default 1 mes
    END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_visa_expiration IS 'Calcula fecha de expiración según tipo de visa (residente = null, demás = 1 mes)';

-- 9. Trigger para actualizar updated_at en currency_exchange_locations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_currency_exchange_locations_updated_at
    BEFORE UPDATE ON currency_exchange_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. Índices adicionales para performance
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date DESC);
CREATE INDEX IF NOT EXISTS idx_us_visas_expiration ON us_visas(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_us_visas_renewable ON us_visas(renewable) WHERE renewable = true;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar que todas las tablas se crearon correctamente
DO $$
BEGIN
    RAISE NOTICE 'Verificando tablas creadas...';
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'exchange_rates') THEN
        RAISE NOTICE '✓ exchange_rates creada';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'us_credit_cards') THEN
        RAISE NOTICE '✓ us_credit_cards creada';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'currency_transactions') THEN
        RAISE NOTICE '✓ currency_transactions creada';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'currency_exchange_locations') THEN
        RAISE NOTICE '✓ currency_exchange_locations creada';
    END IF;
    
    RAISE NOTICE 'Migración completada exitosamente!';
END $$;
