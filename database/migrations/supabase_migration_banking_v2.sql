-- BANKING V2 MIGRATION
-- Adds support for Investments, Payroll, and General Banking Logs

-- 1. Banking Transactions (Unified Log for Transfers, Investments, Payroll)
create table if not exists banking_transactions (
  id uuid default uuid_generate_v4() primary key,
  sender_discord_id text not null,
  receiver_discord_id text, -- Null if system/bank
  amount numeric not null,
  type text check (type in ('transfer', 'investment', 'payroll', 'tax', 'fine', 'withdrawal', 'deposit')) not null,
  description text,
  metadata jsonb, -- Flexible storage for extra data (e.g. investment_id)
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Investments (Plazo Fijo)
create table if not exists investments (
  id uuid default uuid_generate_v4() primary key,
  discord_id text not null,
  invested_amount numeric not null,
  interest_rate numeric not null, -- Percentage (e.g. 5)
  start_date timestamp with time zone default timezone('utc'::text, now()),
  end_date timestamp with time zone not null, -- When it matures
  status text check (status in ('active', 'completed', 'early_withdrawal')) default 'active',
  payout_amount numeric, -- Calculated expected payout
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Payroll Groups (Nominas)
create table if not exists payroll_groups (
  id uuid default uuid_generate_v4() primary key,
  owner_discord_id text not null,
  name text not null, -- e.g. "Empleados Taller"
  description text,
  total_salary numeric default 0, -- Auto-calculated cache
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Payroll Members
create table if not exists payroll_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references payroll_groups(id) on delete cascade not null,
  member_discord_id text not null, -- Employee
  role_name text, -- e.g. "Gerente"
  salary numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(group_id, member_discord_id)
);

-- 5. Citizen Preferences
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'citizens' and column_name = 'notifications_enabled') then
        alter table citizens add column notifications_enabled boolean default true;
    end if;
end $$;

-- Enable RLS (Already done but ensuring)
alter table banking_transactions enable row level security;
alter table investments enable row level security;
alter table payroll_groups enable row level security;
alter table payroll_members enable row level security;

-- Policies (Simplified: Staff can do all, Users view their own)
-- Transactions
create policy "Staff manage transactions" on banking_transactions for all using (auth.role() = 'authenticated');
create policy "Users view own sender transactions" on banking_transactions for select using (auth.role() = 'authenticated'); -- Logic handled by bot mostly

-- Investments
create policy "Staff manage investments" on investments for all using (auth.role() = 'authenticated');

-- Payroll
create policy "Staff manage payroll" on payroll_groups for all using (auth.role() = 'authenticated');
create policy "Staff manage payroll members" on payroll_members for all using (auth.role() = 'authenticated');
