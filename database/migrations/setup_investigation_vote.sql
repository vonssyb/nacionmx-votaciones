-- Deactivate all currently active elections
UPDATE elections SET is_active = false WHERE is_active = true;

-- Insert the new election
WITH new_election AS (
  INSERT INTO elections (title, position, description, is_active, voting_open)
  VALUES (
    'Resolución de Investigación en Curso',
    'Referéndum Extraordinario',
    'Votación extraordinaria para definir el futuro político tras la investigación en curso.',
    true,
    true
  )
  RETURNING id
)
-- Insert candidates (options) for the new election
INSERT INTO election_candidates (election_id, name, party, proposals, photo_url, logo_url)
SELECT 
  id, 
  'Movimiento Ciudadano asume el Poder', 
  'Resolución A', 
  'Se reconoce a Movimiento Ciudadano como ganador y asume el poder inmediatamente.',
  'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png', -- Placeholder, user can update
  'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png'  -- Placeholder
FROM new_election
UNION ALL
SELECT 
  id, 
  'Repetir Elecciones', 
  'Resolución B', 
  'Se anulan los resultados previos y se convoca a nuevas elecciones generales.',
  'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png', -- Placeholder
  'https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png'  -- Placeholder
FROM new_election;
