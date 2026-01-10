-- Solución al error 42P10 (Falta constraint unique)
-- En lugar de UPSERT, hacemos DELETE preventivo + INSERT

-- 1. Eliminar entrada anterior si existe
DELETE FROM job_salaries WHERE role_id = '1459674442501456074';

-- 2. Insertar nueva configuración
INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount)
VALUES (
    '1412803882773643325', -- Guild ID
    '1459674442501456074', -- Role ID FEC
    'Fuerza Especial Conjunta (FEC)',
    5000
);

-- OPCIONAL: Para arreglar la tabla a futuro y permitir UPSERTs, ejecuta esto (si no tienes duplicados):
-- ALTER TABLE job_salaries ADD CONSTRAINT job_salaries_role_id_key UNIQUE (role_id);
