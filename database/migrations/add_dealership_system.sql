-- Migración: add_dealership_system.sql
-- Descripción: Tablas para el sistema de concesionario avanzado (Dealership Bot)

-- 1. Catálogo de Vehículos
CREATE TABLE IF NOT EXISTS dealership_catalog (
    id SERIAL PRIMARY KEY,
    make VARCHAR(50) NOT NULL, -- Marca (e.g., Toyota, BMW)
    model VARCHAR(100) NOT NULL, -- Modelo (e.g., Supra, M4)
    category VARCHAR(50) NOT NULL, -- sedan, deportivo, suv, moto, lujo, etc.
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT, -- URL de la imagen principal
    specs JSONB DEFAULT '{}', -- { "velocidad": "200km/h", "plazas": 4, "motor": "V8" }
    finance_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ventas y Solicitudes
CREATE TABLE IF NOT EXISTS dealership_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL, -- Discord User ID
    guild_id VARCHAR(50) NOT NULL,
    vehicle_id INTEGER REFERENCES dealership_catalog(id),
    price_total NUMERIC(15, 2) NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0,
    payment_method VARCHAR(20) NOT NULL, -- 'cash', 'bank', 'finance'
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed, financing
    
    -- Financiamiento
    finance_plan JSONB DEFAULT NULL, -- { "total_installments": 10, "paid_installments": 0, "amount_per_installment": 5000 }
    
    contract_url TEXT, -- Link del mensaje con el contrato o PDF generado
    delivery_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    approver_id VARCHAR(50), -- Staff que aprobó
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Entregas / Citas
CREATE TABLE IF NOT EXISTS dealership_appointments (
    id SERIAL PRIMARY KEY,
    sale_id UUID REFERENCES dealership_sales(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, completed, missed, cancelled
    location VARCHAR(100) DEFAULT 'Concesionario Principal',
    staff_id VARCHAR(50), -- Staff asignado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Settings de la Agencia
CREATE TABLE IF NOT EXISTS dealership_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT
);

-- Insertar configuración inicial por defecto
INSERT INTO dealership_settings (key, value, description)
VALUES 
    ('channel_tickets', '"000000000000000000"', 'ID del canal para tickets de compra'),
    ('role_staff', '"000000000000000000"', 'ID del rol de vendedores'),
    ('location_coords', '{"x": 123, "y": 456, "desc": "Downtown ERLC"}', 'Ubicación RP'),
    ('finance_rates', '{"down_payment_percent": 20, "interest_rate": 5, "max_installments": 10}', 'Configuración de financiamiento')
ON CONFLICT (key) DO NOTHING;

-- Indices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_dealership_catalog_category ON dealership_catalog(category);
CREATE INDEX IF NOT EXISTS idx_dealership_sales_user ON dealership_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_dealership_sales_status ON dealership_sales(status);
