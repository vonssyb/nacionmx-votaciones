-- Premium Membership Salaries
-- Ejecuta estos INSERT SOLO UNA VEZ en Supabase
-- Si ya existen, primero elimina los registros viejos

-- Premium: $45,000 cada 72 horas
INSERT INTO payroll_members (role_id, role_name, salary_amount)
VALUES 
    ('1412887172503175270', 'Premium', 45000);

-- Booster: $40,000 cada 72 horas
INSERT INTO payroll_members (role_id, role_name, salary_amount)
VALUES 
    ('1423520675158691972', 'Booster', 40000);

-- UltraPass: $100,000 cada 72 horas
INSERT INTO payroll_members (role_id, role_name, salary_amount)
VALUES 
    ('1414033620636532849', 'UltraPass', 100000);
