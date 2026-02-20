-- Premium Membership Salaries
-- Insert into job_salaries table (misma estructura que supabase_salary_system.sql)

INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount) VALUES
('1398525215134318713', '1412887172503175270', 'Premium', 45000),
('1398525215134318713', '1423520675158691972', 'Booster', 40000),
('1398525215134318713', '1414033620636532849', 'UltraPass', 100000)
ON CONFLICT (guild_id, role_id) DO UPDATE SET
    salary_amount = EXCLUDED.salary_amount,
    updated_at = NOW();
