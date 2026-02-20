-- 1. HABILITAR EXTENSIONES (Necesario para IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 2. ARREGLAR TABLA DE EMPRESAS (COMPANIES)
-- ==========================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    description TEXT,
    industry_type TEXT NOT NULL,
    location TEXT,
    vehicle_count INTEGER DEFAULT 0,
    is_private BOOLEAN DEFAULT FALSE,
    owner_ids TEXT[] DEFAULT '{}',
    balance DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    website TEXT,
    founded_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE companies ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_ids TEXT[] DEFAULT '{}';


-- ==========================================
-- 3. ARREGLAR TABLA DE EMPLEADOS (EMPLOYEES)
-- ==========================================
CREATE TABLE IF NOT EXISTS company_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    citizen_id UUID, -- Opcional si no usas tabla citizens aun
    discord_user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    salary DECIMAL(10,2) DEFAULT 0,
    hired_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'fired'))
);


-- ==========================================
-- 4. ARREGLAR TARJETAS DE CRÉDITO (FIX ERROR ACTUAL)
-- ==========================================
CREATE TABLE IF NOT EXISTS credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id TEXT NOT NULL, -- Antes era discord_user_id en algunos scripts
    card_name TEXT NOT NULL,
    card_type TEXT NOT NULL,
    card_limit DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) DEFAULT 0,
    interest_rate DECIMAL(5,4) NOT NULL, -- Ej: 0.05 para 5%
    closing_day INTEGER DEFAULT 1,
    payment_due_day INTEGER DEFAULT 10,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    company_id UUID REFERENCES companies(id) -- Para tarjetas business
);

-- ! IMPORTANTE: Añadir columnas faltantes si la tabla ya existe
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS card_limit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,4) DEFAULT 0.05;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS discord_id TEXT;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS card_name TEXT;


-- ==========================================
-- 5. ARREGLAR TARJETAS DE DÉBITO
-- ==========================================
CREATE TABLE IF NOT EXISTS debit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_number TEXT UNIQUE NOT NULL,
    discord_user_id TEXT NOT NULL,
    pin TEXT, -- Encriptado idealmente
    balance DECIMAL(15,2) DEFAULT 0, -- Opcional si usas UB Service
    card_tier TEXT DEFAULT 'NMX Débito', -- Fix solicitado antes
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS card_tier TEXT DEFAULT 'NMX Débito';


-- ==========================================
-- 6. LICENCIAS
-- ==========================================
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_user_id TEXT NOT NULL,
    license_type TEXT NOT NULL, -- 'armas', 'conducir', 'piloto', etc.
    issued_by TEXT NOT NULL, -- Discord ID del staff
    issued_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    status TEXT DEFAULT 'active',
    notes TEXT
);

-- Crear índices para velocidad
CREATE INDEX IF NOT EXISTS idx_companies_owners ON companies USING GIN(owner_ids);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON credit_cards(discord_id);
CREATE INDEX IF NOT EXISTS idx_debit_cards_user ON debit_cards(discord_user_id);

-- Recargar caché de esquema (Esto suele ser automático, pero modificar columnas ayuda)
NOTIFY pgrst, 'reload schema';
