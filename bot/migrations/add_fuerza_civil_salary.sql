-- Add Salary for Fuerza Civil
insert into job_salaries (guild_id, role_id, role_name, salary_amount)
values 
  ('1398525215134318713', '1471649565974466673', 'Fuerza Civil', 45000)
on conflict (guild_id, role_id) do update set salary_amount = 45000;
