-- Add Government Salaries based on President ($100,000)

-- Vicepresidente: $75,000
insert into job_salaries (guild_id, role_id, role_name, salary_amount)
values 
  ('1398525215134318713', '1466165678980464802', 'Vicepresidente', 75000)
on conflict (guild_id, role_id) do update set salary_amount = 75000;

-- Secretarios: $50,000
insert into job_salaries (guild_id, role_id, role_name, salary_amount)
values 
  ('1398525215134318713', '1466248918294593586', 'Secretario de economia', 50000),
  ('1398525215134318713', '1466248809196818474', 'Secretario de defensa', 50000),
  ('1398525215134318713', '1466249013891305544', 'Secretario ambiental', 50000),
  ('1398525215134318713', '1466249089447497984', 'Secretario de salud', 50000)
on conflict (guild_id, role_id) do update set salary_amount = 50000;
