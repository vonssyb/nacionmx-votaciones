-- Solución al error 42P10 (Falta constraint unique)
-- En lugar de UPSERT, hacemos DELETE preventivo + INSERT

-- 1. Eliminar entrada anterior si existe
DELETE FROM job_salaries WHERE role_id = '1459674442501456074';

-- 2. Insertar nueva configuración
INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount)
VALUES (
    '1398525215134318713', -- Guild ID (Actualizado al actual)
    '1459674442501456074', -- Role ID FEC (Verificado en config)
    'Fuerza Especial Conjunta (FEC)',
    15000 -- Salario Sugerido (Ajustar si es necesario)
);

-- OPCIONAL: Para arreglar la tabla a futuro y permitir UPSERTs, ejecuta esto (si no tienes duplicados):
-- ALTER TABLE job_salaries ADD CONSTRAINT job_salaries_role_id_key UNIQUE (role_id);
