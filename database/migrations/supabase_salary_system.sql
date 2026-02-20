-- Salary System for Nación MX
-- Tables for job-based salary collection with 72h cooldown

CREATE TABLE IF NOT EXISTS job_salaries (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    salary_amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS salary_collections (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    role_used TEXT NOT NULL,
    gross_amount INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL,
    net_amount INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salary_collections_user ON salary_collections(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_salary_collections_time ON salary_collections(collected_at DESC);

INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount) VALUES
('1398525215134318713', '1412887183089471568', 'Presidente', 100000),
('1398525215134318713', '1412891374700724234', 'Candidato a Presidencia', 45000),
('1398525215134318713', '1412891683535982632', 'Abogado', 40000),
('1398525215134318713', '1412898905842122872', 'Ejército Mexicano', 22000),
('1398525215134318713', '1412898908706963507', 'Infantería Marina', 18000),
('1398525215134318713', '1457135315323195432', 'SSPC', 13000),
('1398525215134318713', '1412898911185797310', 'Guardia Nacional', 13000),
('1398525215134318713', '1412898916021829903', 'AIC', 12000),
('1398525215134318713', '1413541371503185961', 'Juez', 15000),
('1398525215134318713', '1455037616054341704', 'Policía Estatal', 5000),
('1398525215134318713', '1416867605976715363', 'Policía Federal', 4500),
('1398525215134318713', '1413540726100332574', 'Paramédico', 4000),
('1398525215134318713', '1412899382436827369', 'Bombero', 4500),
('1398525215134318713', '1413540732760883311', 'Reportero', 2000),
('1398525215134318713', '1413540735487053924', 'Basurero', 1500),
('1398525215134318713', '1412899385519640707', 'Policía de Tránsito', 4500),
('1398525215134318713', '1450242487422812251', 'Staff', 40000)
ON CONFLICT (guild_id, role_id) DO UPDATE SET
    salary_amount = EXCLUDED.salary_amount,
    updated_at = NOW();
