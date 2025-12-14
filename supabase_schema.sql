-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (Users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  username text unique,
  roblox_id text,
  full_name text,
  role text check (role in ('owner', 'co_owner', 'admin', 'board', 'moderator', 'developer')),
  avatar_url text,
  status text check (status in ('online', 'idle', 'dnd', 'offline')) default 'offline',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create Activity Logs Table
create table if not exists activity_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text check (type in ('ban', 'warn', 'kick', 'ticket', 'patrol')) not null,
  target_username text not null,
  target_roblox_id text,
  reason text not null,
  evidence_url text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create BOLO (Be On Look Out) Table
create table if not exists bolos (
  id uuid default uuid_generate_v4() primary key,
  target_name text not null,
  target_image text,
  crimes text[] not null,
  status text check (status in ('wanted', 'captured', 'deceased')) default 'wanted',
  bounty text,
  last_seen text,
  reported_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Create Applications Table
create table if not exists applications (
  id uuid default uuid_generate_v4() primary key,
  applicant_username text not null,
  applicant_discord_id text,
  type text check (type in ('whitelist', 'police', 'ems', 'unban', 'staff')) not null,
  content jsonb not null, -- Stores application answers
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  reviewer_id uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  reviewed_at timestamp with time zone
);

-- 5. Time Logs (Shift Management) [UPDATED]
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

-- 6. Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table activity_logs enable row level security;
alter table bolos enable row level security;
alter table applications enable row level security;
alter table time_logs enable row level security;

-- 7. RLS Policies

-- PROFILES
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- ACTIVITY LOGS
drop policy if exists "Staff can view all logs" on activity_logs;
create policy "Staff can view all logs"
  on activity_logs for select
  using ( auth.role() = 'authenticated' );

drop policy if exists "Staff can create logs" on activity_logs;
create policy "Staff can create logs"
  on activity_logs for insert
  with check ( auth.role() = 'authenticated' );

-- BOLOS
drop policy if exists "Staff can view BOLOs" on bolos;
create policy "Staff can view BOLOs"
  on bolos for select
  using ( auth.role() = 'authenticated' );

drop policy if exists "Staff can manage BOLOs" on bolos;
create policy "Staff can manage BOLOs"
  on bolos for all
  using ( auth.role() = 'authenticated' );

-- APPLICATIONS
drop policy if exists "Staff can view applications" on applications;
create policy "Staff can view applications"
  on applications for select
  using ( auth.role() = 'authenticated' );

drop policy if exists "Staff can update applications" on applications;
create policy "Staff can update applications"
  on applications for update
  using ( auth.role() = 'authenticated' );

-- TIME LOGS [NEW]
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

-- 8. Functions & Triggers

-- Handle New User (Auto-profile creation on signup)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, username)
  values (new.id, new.email, 'moderator', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. Storage Policies [NEW]
-- Create 'evidence' bucket if logs need images
insert into storage.buckets (id, name, public) 
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

drop policy if exists "Staff can upload evidence" on storage.objects;
create policy "Staff can upload evidence"
  on storage.objects for insert
  with check ( bucket_id = 'evidence' and auth.role() = 'authenticated' );

drop policy if exists "Public can view evidence" on storage.objects;
create policy "Public can view evidence"
  on storage.objects for select
  using ( bucket_id = 'evidence' );
