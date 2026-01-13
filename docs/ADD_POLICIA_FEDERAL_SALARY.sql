-- Agregar salario para Policía Federal
-- ID del Rol: 1412898913345863760
-- Monto: $4,500
-- Guilds: Principal y Alternativo

INSERT INTO public.job_salaries (guild_id, role_id, role_name, salary_amount)
VALUES 
    -- Guild Principal
    ('1412803882773643325', '1412898913345863760', 'Policía Federal', 4500),
    -- Guild Alternativo (por si acaso)
    ('1398525215134318713', '1412898913345863760', 'Policía Federal', 4500)
ON CONFLICT (guild_id, role_id) 
DO UPDATE SET 
    salary_amount = EXCLUDED.salary_amount,
    role_name = EXCLUDED.role_name;
