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

-- RLS Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

-- Companies: Read all
DROP POLICY IF EXISTS "Enable read access for all users" ON companies;
CREATE POLICY "Enable read access for all users" ON companies FOR SELECT USING (true);

-- Companies: Insert/Update (Service Role only for now, or owners via bot logic)
-- We'll allow public insert because the bot handles the checks, but strictly we could restrict it.
-- For simplicity in this iteration:
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON companies;
CREATE POLICY "Enable insert for authenticated users only" ON companies FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for owners" ON companies;
CREATE POLICY "Enable update for owners" ON companies FOR UPDATE USING (true);

-- Employees Policies
DROP POLICY IF EXISTS "Read all employees" ON company_employees;
CREATE POLICY "Read all employees" ON company_employees FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert employees" ON company_employees;
CREATE POLICY "Insert employees" ON company_employees FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update employees" ON company_employees;
CREATE POLICY "Update employees" ON company_employees FOR UPDATE USING (true);
