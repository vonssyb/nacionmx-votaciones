-- Fix for missing company_id column in payroll_groups

ALTER TABLE payroll_groups 
ADD COLUMN IF NOT EXISTS company_id uuid references companies(id) on delete cascade;

-- Verify if index exists, if not create it
CREATE INDEX IF NOT EXISTS payroll_groups_company_idx ON payroll_groups(company_id);
