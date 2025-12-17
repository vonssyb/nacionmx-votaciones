-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    banner_url TEXT, -- New optional field
    description TEXT, -- New optional field
    industry_type TEXT NOT NULL, -- e.g. Automotriz, Seguridad, Alimentos
    location TEXT, -- New optional field (e.g. "Calle 123, Centro")
    vehicle_count INTEGER DEFAULT 0,
    is_private BOOLEAN DEFAULT FALSE,
    owner_ids TEXT[] DEFAULT '{}', -- Array of Discord IDs
    balance DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    website TEXT, -- New optional field
    founded_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. COMPANY EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS company_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    citizen_id UUID REFERENCES citizens(id),
    discord_user_id TEXT NOT NULL,
    role TEXT NOT NULL, -- e.g. 'Gerente', 'Vendedor', 'Conductor'
    salary DECIMAL(10,2) DEFAULT 0,
    hired_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'fired'))
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_companies_owners ON companies USING GIN(owner_ids);
CREATE INDEX IF NOT EXISTS idx_employees_company ON company_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON company_employees(discord_user_id);

-- 4. RLS POLICIES (Enable RLS but allow everything for now via service role, specific policies can be added later)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON companies FOR SELECT USING (true);
CREATE POLICY "Enable all access for service role" ON companies USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for service role employees" ON company_employees USING (true) WITH CHECK (true);
