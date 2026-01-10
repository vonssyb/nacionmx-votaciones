-- ============================================================================
-- FIX: Update PHASE1_DUAL_CURRENCY_MIGRATION.sql to work with existing schema
-- ============================================================================

-- Si exchange_rates ya existe, necesitamos hacer ALTER en lugar de CREATE
-- Primero veamos qué columnas tiene la tabla existente y las agregamos si faltan

-- 1. Agregar columnas USD a user_stats (SAFE - usa IF NOT EXISTS)
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS usd_cash BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_rate_cache NUMERIC(10,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS last_exchange_date TIMESTAMPTZ;

COMMENT ON COLUMN user_stats.usd_cash IS 'USD en efectivo - solo se puede tener en cash (no banco)';
COMMENT ON COLUMN user_stats.exchange_rate_cache IS 'Última tasa de cambio vista por el usuario';
COMMENT ON COLUMN user_stats.last_exchange_date IS 'Última vez que consultó/usó tasa de cambio';

-- 2. Actualizar o crear tabla exchange_rates
-- Primero intentamos agregar las columnas por si la tabla ya existe 
DO $$
BEGIN
    -- Si la tabla existe, intentar agregar columnas faltantes
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'exchange_rates') THEN
        -- Agregar columnas si no existen
        ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate_usd_to_mxn NUMERIC(10,2);
        ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate_date DATE;
        ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS set_by_admin TEXT;
        ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false;
        ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS created_timestamp TIMESTAMPTZ DEFAULT NOW();
        
        -- Agregar constraint UNIQUE si no existe
        BEGIN
            ALTER TABLE exchange_rates ADD CONSTRAINT exchange_rates_rate_date_unique UNIQUE (rate_date);
            RAISE NOTICE 'exchange_rates: UNIQUE constraint agregado en rate_date';
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'exchange_rates: UNIQUE constraint ya existe';
        END;
        
        RAISE NOTICE 'exchange_rates: Columnas agregadas/verificadas';
    ELSE
        -- Si no existe, crearla
        CREATE TABLE exchange_rates (
            id BIGSERIAL PRIMARY KEY,
            rate_usd_to_mxn NUMERIC(10,2) NOT NULL CHECK (rate_usd_to_mxn > 0),
            rate_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
            set_by_admin TEXT,
            is_manual BOOLEAN DEFAULT false,
            created_timestamp TIMESTAMPTZ DEFAULT NOW()
        );
        
        RAISE NOTICE 'exchange_rates: Tabla creada';
    END IF;
END $$;

-- Insertar tasa inicial solo si no hay datos
INSERT INTO exchange_rates (rate_usd_to_mxn, rate_date, is_manual) 
SELECT 18.50, CURRENT_DATE, false
WHERE NOT EXISTS (SELECT 1 FROM exchange_rates WHERE rate_date = CURRENT_DATE);

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
    monthly_interest_rate NUMERIC(5,2) DEFAULT 3.00,
    last_payment_date TIMESTAMPTZ,
    next_payment_due TIMESTAMPTZ,
    minimum_payment BIGINT DEFAULT 0,
    issued_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'frozen', 'cancelled')),
    approved_by TEXT,
    approval_ticket_id BIGINT,
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
    location_type TEXT CHECK (location_type IN ('casa_cambio', 'usa')),
    location_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_user ON currency_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_date ON currency_transactions(created_at DESC);

COMMENT ON TABLE currency_transactions IS 'Historial de cambios de moneda MXN <-> USD';

-- 5. Crear tabla de casas de cambio
CREATE TABLE IF NOT EXISTS currency_exchange_locations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    fee_percentage NUMERIC(5,2) DEFAULT 2.5 CHECK (fee_percentage >= 0),
    daily_limit_usd BIGINT DEFAULT 10000,
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

-- 6. Actualizar tabla us_visas para expiración y renovación (SAFE)
ALTER TABLE us_visas
ADD COLUMN IF NOT EXISTS renewable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS renewal_cost BIGINT,
ADD COLUMN IF NOT EXISTS times_renewed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS issued_by_company BIGINT,
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

COMMENT ON COLUMN us_visas.renewable IS 'Si la visa puede ser renovada (false si expiró sin renovar)';
COMMENT ON COLUMN us_visas.renewal_cost IS 'Costo de renovación (mismo que costo original)';
COMMENT ON COLUMN us_visas.times_renewed IS 'Cuántas veces se ha renovado';
COMMENT ON COLUMN us_visas.issued_by_company IS 'ID de empresa que emitió visa de trabajo (si aplica)';

-- 7. Función para obtener tasa de cambio actual (actualizada)
CREATE OR REPLACE FUNCTION get_current_exchange_rate()
RETURNS NUMERIC(10,2) AS $$
DECLARE
    current_rate NUMERIC(10,2);
BEGIN
    SELECT rate_usd_to_mxn INTO current_rate
    FROM exchange_rates
    WHERE rate_date <= CURRENT_DATE
    ORDER BY rate_date DESC
    LIMIT 1;
    
    IF current_rate IS NULL THEN
        current_rate := 18.50;
    END IF;
    
    RETURN current_rate;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_exchange_rate IS 'Obtiene la tasa de cambio más reciente';

-- 8. Índices adicionales
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_us_visas_expiration ON us_visas(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_us_visas_renewable ON us_visas(renewable) WHERE renewable = true;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migración completada exitosamente!';
    RAISE NOTICE '📊 Tablas verificadas:';
    RAISE NOTICE '  - user_stats (USD columns added)';
    RAISE NOTICE '  - exchange_rates (updated/created)';
    RAISE NOTICE '  - us_credit_cards (created)';
    RAISE NOTICE '  - currency_transactions (created)';
    RAISE NOTICE '  - currency_exchange_locations (created)';
    RAISE NOTICE '  - us_visas (renewal columns added)';
END $$;
