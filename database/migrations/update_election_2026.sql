-- Migration: update_election_2026.sql
-- Description: Actualiza candidatos y agrega gabinete para la elección 2026

-- 1. Add 'cabinet' column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'election_candidates' AND column_name = 'cabinet') THEN
        ALTER TABLE election_candidates ADD COLUMN cabinet JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Clear old candidates for 'Elección Presidencial 2026' (to avoid duplicates/mess)
DELETE FROM election_candidates 
WHERE election_id IN (SELECT id FROM elections WHERE title = 'Elección Presidencial 2026');

-- 3. Insert New Candidates & Cabinet
-- We need to look up the election ID dynamically

WITH pres_election AS (
    SELECT id FROM elections WHERE title = 'Elección Presidencial 2026' LIMIT 1
)
INSERT INTO election_candidates (election_id, name, party, photo_url, logo_url, proposals, cabinet)
SELECT 
    id, 
    'Brandon Hernandez', 
    'Movimiento Ciudadano', 
    'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/brandon.png',
    'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/IMG_20260206_150400.png',
    'Propuestas de Movimiento Ciudadano...',
    '[
        {"position": "Vicepresidente", "name": "Daniel Juarez Vargas", "discord_id": "1403153392368488548"},
        {"position": "Secretario de Defensa", "name": "Sam Pupu", "discord_id": "1455097321841885389"},
        {"position": "Secretario de Salud", "name": "Gael Feliz", "discord_id": "1383865809348329592"},
        {"position": "Secretario de Economía", "name": "Elvis Caso", "discord_id": "1340115468262047788"},
        {"position": "Secretario de Justicia", "name": "Erick Contreras", "discord_id": "1414386068266024990"}
    ]'::jsonb
FROM pres_election
UNION ALL
SELECT 
    id, 
    'Camilo Cruz', 
    'Partido Verde', 
    'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/camilo.png',
    'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ChatGPT_Image_4_feb_2026_09_05_45_p.m..png',
    'Propuestas del Partido Verde...',
    '[
        {"position": "Vicepresidente", "name": "Esteban Martinez", "discord_id": "1289425000352321649"},
        {"position": "Secretario de Defensa", "name": "Petin Don", "discord_id": "1178362384860074104"},
        {"position": "Secretario de Salud", "name": "Mateo Juarez", "discord_id": "1384741888749338634"},
        {"position": "Secretario de Economía", "name": "Emmanuel Omaseye", "discord_id": "1449498739797393573"},
        {"position": "Secretario de Justicia", "name": "Junior Hernandez Peralta", "discord_id": "1385999468054450211"}
    ]'::jsonb
FROM pres_election;
