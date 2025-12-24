-- =====================================================
-- NacionMX Premium Store System
-- In-game currency store for premium perks and passes
-- =====================================================

-- Store Items Catalog
CREATE TABLE IF NOT EXISTS store_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    duration_days INTEGER, -- NULL = permanent
    duration_hours INTEGER, -- for special durations like casino (1h)
    category TEXT NOT NULL, -- 'vehicle', 'weapon', 'protection', 'social', 'premium'
    role_id TEXT, -- Discord role to assign
    requires_ticket BOOLEAN DEFAULT false, -- If true, show ticket message
    ticket_channel_id TEXT, -- Channel ID for ticket
    max_uses INTEGER, -- For consumables like insurance
    icon_emoji TEXT,
    benefits JSONB, -- Array of benefit descriptions
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Purchases/Active Passes
CREATE TABLE IF NOT EXISTS user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL REFERENCES store_items(item_key),
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    expiration_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'consumed'
    uses_remaining INTEGER, -- For insurance/consumables
    metadata JSONB, -- Custom data (sticker URL, vehicle details, etc)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Transaction Log
CREATE TABLE IF NOT EXISTS purchase_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    amount_paid INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'debit_card',
    purchase_id UUID REFERENCES user_purchases(id),
    transaction_type TEXT DEFAULT 'purchase', -- 'purchase', 'refund', 'expiration'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_status ON user_purchases(status);
CREATE INDEX IF NOT EXISTS idx_user_purchases_expiration ON user_purchases(expiration_date);
CREATE INDEX IF NOT EXISTS idx_user_purchases_item ON user_purchases(item_key);
CREATE INDEX IF NOT EXISTS idx_store_items_active ON store_items(active);
CREATE INDEX IF NOT EXISTS idx_purchase_transactions_user ON purchase_transactions(user_id);

-- =====================================================
-- INSERT STORE ITEMS (11 Total)
-- =====================================================

INSERT INTO store_items (item_key, name, description, price, duration_days, category, role_id, icon_emoji, benefits, display_order) VALUES
(
    'premium_role',
    'Rol Premium',
    'El paquete más top del servidor para llevar tu experiencia al siguiente nivel.',
    4000000,
    30,
    'premium',
    '1449950535166726317',
    '👑',
    '["Rol y color únicos", "Áreas VIP exclusivas", "Descuentos máximos en impuestos", "Prioridad en eventos y tickets", "Acceso extendido a vehículos/armas"]'::jsonb,
    1
),
(
    'heavy_weapons',
    'Armas Pesadas',
    'Francotirador o M2 para máxima potencia en enfrentamientos.',
    320000,
    3,
    'weapon',
    '1449949468517470285',
    '🔫',
    '["Francotirador o M2", "Ventaja en combates", "Defensa preventiva premium"]'::jsonb,
    2
),
(
    'sports_car',
    'Coche Deportivo',
    'Potencia, lujo y velocidad para presumir en la ciudad.',
    280000,
    7,
    'vehicle',
    '1449949914154012878',
    '🏎️',
    '["Máxima velocidad", "Carreras ilegales", "Estilo y prestigio"]'::jsonb,
    3
),
(
    'swat_vehicle',
    'Armamento SWAT',
    'Vehículo blindado con arsenal militar para operativos especiales.',
    120000,
    3,
    'vehicle',
    '1449949722050691132',
    '🚓',
    '["Vehículo SWAT blindado", "Armamento táctico incluido", "Resistencia a daños", "Ideal para operativos PVP"]'::jsonb,
    4
),
(
    'anti_rob',
    'Escolta ANTIROBO',
    'Protección 24/7 contra robos (!rob) durante toda la semana.',
    60000,
    7,
    'protection',
    '1449947645383675939',
    '🛡️',
    '["Defensa vs !rob", "Protección 24/7", "Seguridad total para negocios"]'::jsonb,
    5
),
(
    'custom_sticker',
    'Sticker Personalizado',
    'Sube tu propio sticker único al servidor (permanente).',
    350000,
    NULL,
    'social',
    '1449950778499268619',
    '🎨',
    '["Sticker permanente", "Diseño personal o meme", "Usado por todos los jugadores"]'::jsonb,
    6
),
(
    'casino_access',
    'Casino',
    'Acceso ilimitado al casino durante 1 hora completa.',
    600000,
    NULL,
    'social',
    '1449951345611378841',
    '🎰',
    '["1 hora de acceso", "Mesas y máquinas ilimitadas", "Duplica o pierde con estilo"]'::jsonb,
    7
),
(
    'anti_ck',
    'Anti CK - Seguro de Vida',
    'Anula 1 FEC para proteger tu personaje.',
    700000,
    3,
    'protection',
    '1449950413993410651',
    '💚',
    '["Anula 1 FEC", "Mantiene progreso y propiedades", "Seguro de vida total"]'::jsonb,
    8
),
(
    'undercover_vehicle',
    'Vehículo Undercover',
    'Sigiloso pero con estilo para operaciones encubiertas.',
    100000,
    3,
    'vehicle',
    '1449950079887605880',
    '🚗',
    '["Movimiento sigiloso", "Ideal para seguimientos", "Velocidad y maniobrabilidad"]'::jsonb,
    9
),
(
    'tax_evasion',
    'Evasión de Impuestos',
    'Reduce impuestos y duplica ganancias (con riesgo de arresto).',
    380000,
    7,
    'premium',
    '1449950636371214397',
    '💸',
    '["Impuestos mínimos", "Doble de ganancias", "⚠️ Riesgo de arresto policial"]'::jsonb,
    10
),
(
    'content_creator',
    'Fotos y Compartir Pantalla',
    'Permisos para subir fotos y compartir pantalla en voz.',
    150000,
    7,
    'social',
    '1449948475935424583',
    '📸',
    '["Subir fotos a chats", "Compartir pantalla en voz", "Ideal para streamers"]'::jsonb,
    11
);

-- Update special items with ticket requirements
UPDATE store_items 
SET requires_ticket = true, ticket_channel_id = '1398889153919189042'
WHERE item_key IN ('sports_car', 'swat_vehicle', 'undercover_vehicle');

-- Update casino with hour duration
UPDATE store_items 
SET duration_hours = 1, duration_days = NULL
WHERE item_key = 'casino_access';

-- Update anti_ck with max uses
UPDATE store_items 
SET max_uses = 1
WHERE item_key = 'anti_ck';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get active purchases for a user
CREATE OR REPLACE FUNCTION get_user_active_purchases(p_user_id TEXT)
RETURNS TABLE (
    purchase_id UUID,
    item_key TEXT,
    item_name TEXT,
    expiration_date TIMESTAMPTZ,
    uses_remaining INTEGER,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.item_key,
        si.name,
        up.expiration_date,
        up.uses_remaining,
        CASE 
            WHEN up.expiration_date IS NULL THEN -1 -- Permanent
            ELSE EXTRACT(DAY FROM (up.expiration_date - NOW()))::INTEGER
        END as days_remaining
    FROM user_purchases up
    JOIN store_items si ON up.item_key = si.item_key
    WHERE up.user_id = p_user_id
      AND up.status = 'active'
      AND (up.expiration_date IS NULL OR up.expiration_date > NOW())
    ORDER BY up.purchase_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old purchases
CREATE OR REPLACE FUNCTION expire_old_purchases()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE user_purchases
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expiration_date IS NOT NULL
      AND expiration_date < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to consume anti-ck insurance
CREATE OR REPLACE FUNCTION consume_anti_ck(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    purchase_record RECORD;
BEGIN
    -- Find active anti-ck purchase with uses remaining
    SELECT * INTO purchase_record
    FROM user_purchases
    WHERE user_id = p_user_id
      AND item_key = 'anti_ck'
      AND status = 'active'
      AND (expiration_date IS NULL OR expiration_date > NOW())
      AND (uses_remaining IS NULL OR uses_remaining > 0)
    ORDER BY purchase_date DESC
    LIMIT 1;
    
    IF purchase_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct a use
    UPDATE user_purchases
    SET 
        uses_remaining = COALESCE(uses_remaining, 1) - 1,
        status = CASE 
            WHEN COALESCE(uses_remaining, 1) - 1 <= 0 THEN 'consumed'
            ELSE 'active'
        END,
        updated_at = NOW()
    WHERE id = purchase_record.id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR EASY QUERIES
-- =====================================================

CREATE OR REPLACE VIEW active_premium_users AS
SELECT DISTINCT
    up.user_id,
    si.item_key,
    si.name as item_name,
    si.role_id,
    up.expiration_date
FROM user_purchases up
JOIN store_items si ON up.item_key = si.item_key
WHERE up.status = 'active'
  AND (up.expiration_date IS NULL OR up.expiration_date > NOW());

-- View for tax evaders (for police)
CREATE OR REPLACE VIEW tax_evaders AS
SELECT 
    up.user_id,
    up.expiration_date,
    EXTRACT(DAY FROM (up.expiration_date - NOW()))::INTEGER as days_remaining
FROM user_purchases up
WHERE up.item_key = 'tax_evasion'
  AND up.status = 'active'
  AND (up.expiration_date IS NULL OR up.expiration_date > NOW());

COMMENT ON VIEW tax_evaders IS 'List of users with active tax evasion pass (visible to police for arrests)';
