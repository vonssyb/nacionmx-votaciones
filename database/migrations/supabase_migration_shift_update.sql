-- MIGRATION SCRIPT: Nacion MX Shift Management Update
-- Run this script to add ONLY the new tables and policies required for the Advanced Shift Management system.
-- This script is safe to run even if other tables (profiles, etc.) already exist.

-- 1. Create Time Logs Table (Shift Management)
create table if not exists time_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  clock_in timestamptz default now(),
  clock_out timestamptz,
  status text check (status in ('active', 'paused', 'completed', 'cancelled')) default 'active',
  breaks jsonb default '[]'::jsonb, -- Array of {start: ts, end: ts}
  description text,
  photos text[], -- Array of URLs
  duration_minutes integer, -- Calculated final duration
  created_at timestamptz default now()
);

-- 2. Enable RLS on Time Logs
alter table time_logs enable row level security;

-- 3. Create RLS Policies for Time Logs (Drop existing to avoid duplication)
drop policy if exists "Staff can view own time logs" on time_logs;
create policy "Staff can view own time logs"
  on time_logs for select
  using ( auth.uid() = user_id );

drop policy if exists "Admins can view all time logs" on time_logs;
create policy "Admins can view all time logs"
  on time_logs for select
  using ( auth.role() = 'authenticated' );

drop policy if exists "Staff can clock in" on time_logs;
create policy "Staff can clock in"
  on time_logs for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Staff can clock out" on time_logs;
create policy "Staff can clock out"
  on time_logs for update
  using ( auth.uid() = user_id );

-- 4. Storage Setup for Evidence
-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Staff can upload evidence" on storage.objects;
create policy "Staff can upload evidence"
  on storage.objects for insert
  with check ( bucket_id = 'evidence' and auth.role() = 'authenticated' );

drop policy if exists "Public can view evidence" on storage.objects;
create policy "Public can view evidence"
  on storage.objects for select
  using ( bucket_id = 'evidence' );
