-- Premium Membership Salaries
-- Insert salaries for Premium, Booster, and UltraPass roles

-- Premium: $45,000 cada 7 días
INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount, created_at)
VALUES 
    ('1412882176454189087', '1412887172503175270', 'Premium', 45000, NOW())
ON CONFLICT (guild_id, role_id) DO UPDATE
SET salary_amount = 45000, role_name = 'Premium';

-- Booster: $40,000 cada 7 días  
INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount, created_at)
VALUES 
    ('1412882176454189087', '1423520675158691972', 'Booster', 40000, NOW())
ON CONFLICT (guild_id, role_id) DO UPDATE
SET salary_amount = 40000, role_name = 'Booster';

-- UltraPass: $100,000 cada 7 días
INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount, created_at)
VALUES 
    ('1412882176454189087', '1414033620636532849', 'UltraPass', 100000, NOW())
ON CONFLICT (guild_id, role_id) DO UPDATE
SET salary_amount = 100000, role_name = 'UltraPass';
