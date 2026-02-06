-- Migration: add_election_system.sql
-- Description: Sistema de votaciones para Nacion MX (Presidente, Senadores, Diputados, Magistrados)

-- 1. Elections / Positions Table
CREATE TABLE IF NOT EXISTS elections (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL, -- e.g., 'Elección Presidencial 2026'
    position VARCHAR(50) NOT NULL, -- 'presidente', 'senadores', 'diputados', 'magistrados'
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Candidates Table
CREATE TABLE IF NOT EXISTS election_candidates (
    id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    party VARCHAR(100), -- Nombre del partido o 'Independiente'
    photo_url TEXT, -- URL de la foto del candidato
    logo_url TEXT, -- URL del logo del partido (opcional)
    proposals TEXT, -- Breve descripción o propuestas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Votes Table
CREATE TABLE IF NOT EXISTS election_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL, -- Discord User ID
    election_id INTEGER REFERENCES elections(id) ON DELETE CASCADE,
    candidate_id INTEGER REFERENCES election_candidates(id) ON DELETE CASCADE,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one vote per user per election
    UNIQUE(user_id, election_id)
);

-- 4. Enable RLS
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_votes ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Everyone can read active elections and candidates
CREATE POLICY "Public read elections" ON elections FOR SELECT USING (true);
CREATE POLICY "Public read candidates" ON election_candidates FOR SELECT USING (true);

-- Only authenticated users can vote (handled by API/Bot, but for safety:)
-- We'll allow insert for authenticated users if we use Supabase Auth, 
-- but since we likely use the Bot or a custom service role, we keep it open for service role.
-- For the web portal using Supabase Auth (if connected via Discord):
CREATE POLICY "Users can vote" ON election_votes FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id IS NOT NULL);
CREATE POLICY "Users can see their own votes" ON election_votes FOR SELECT USING (user_id = auth.uid()::text); 

-- 6. Seed Data (Initial Elections)
INSERT INTO elections (title, position, description) VALUES
('Elección Presidencial 2026', 'presidente', 'Vota por el próximo Presidente de la Nación.'),
('Elección de Senadores 2026', 'senadores', 'Elige a los representantes del Senado.'),
('Elección de Diputados 2026', 'diputados', 'Elige a los miembros de la Cámara de Diputados.'),
('Elección de Magistrados 2026', 'magistrados', 'Vota por los Magistrados de la Suprema Corte.')
ON CONFLICT DO NOTHING;

-- Seed Candidates (Placeholders)
-- Presidente
INSERT INTO election_candidates (election_id, name, party, photo_url) 
SELECT id, 'Candidato A', 'Partido Azul', 'https://via.placeholder.com/150' 
FROM elections WHERE position = 'presidente'
LIMIT 1;

INSERT INTO election_candidates (election_id, name, party, photo_url) 
SELECT id, 'Candidato B', 'Partido Rojo', 'https://via.placeholder.com/150' 
FROM elections WHERE position = 'presidente'
LIMIT 1;

-- Senadores
INSERT INTO election_candidates (election_id, name, party, photo_url) 
SELECT id, 'Senador X', 'Partido Verde', 'https://via.placeholder.com/150' 
FROM elections WHERE position = 'senadores'
LIMIT 1;
