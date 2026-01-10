-- Agregar salario para Fuerza Especial Conjunta (FEC)
-- Role ID: 1459674442501456074
-- Salario: $5,000 (Elite/Special Forces tier)

INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount)
VALUES (
    '1412803882773643325', -- Guild ID (Nacion RP)
    '1459674442501456074',
    'Fuerza Especial Conjunta (FEC)',
    5000
)
ON CONFLICT (role_id) 
DO UPDATE SET 
    salary_amount = EXCLUDED.salary_amount,
    role_name = EXCLUDED.role_name;

-- Verificar inserción
-- SELECT * FROM job_salaries WHERE role_id = '1459674442501456074';
