INSERT INTO job_salaries (guild_id, role_id, role_name, salary_amount)
VALUES ('1398525215134318713', '1458505462768079092', 'Gasolinero', 2500)
ON CONFLICT (guild_id, role_id) DO UPDATE SET
    salary_amount = EXCLUDED.salary_amount,
    updated_at = NOW();
