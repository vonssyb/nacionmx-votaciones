-- Create payroll_groups table
create table if not exists payroll_groups (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  owner_discord_id text not null,
  company_id uuid references companies(id) on delete cascade
);

-- Create payroll_items table
create table if not exists payroll_items (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  group_id uuid references payroll_groups(id) on delete cascade not null,
  discord_user_id text not null,
  salary integer not null check (salary > 0)
);

-- Add indexes for performance
create index if not exists payroll_groups_owner_idx on payroll_groups(owner_discord_id);
create index if not exists payroll_items_group_idx on payroll_items(group_id);

-- RLS Policies (Optional but recommended)
alter table payroll_groups enable row level security;
alter table payroll_items enable row level security;

-- Policy: Users can see their own groups
create policy "Users can view own payroll groups"
on payroll_groups for select
using (auth.uid()::text = owner_discord_id); -- Note: This assumes auth.uid() matches discord_id or similar logic. 
-- Since this is a bot, RLS might not be needed if using Service Role key, but good practice.
-- Actually, for the bot service role, RLS is bypassed.
