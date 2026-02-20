-- Migration: Add Banxico Tables
-- Author: Assistant
-- Date: 2026-02-14

-- 1. Electronic Banking Auth Codes
create table if not exists public.banxico_auth_codes (
    id uuid default gen_random_uuid() primary key,
    user_id text not null, -- Discord ID
    code text not null,
    created_at timestamp with time zone default now(),
    expires_at timestamp with time zone not null
);

-- 2. Economic Indicators
create table if not exists public.banxico_indicators (
    id uuid default gen_random_uuid() primary key,
    key text not null unique, 
    name text not null,
    value decimal(24, 4) not null,
    unit text not null, 
    updated_at timestamp with time zone default now(),
    updated_by text 
);

-- 3. Transaction Logs
create table if not exists public.banxico_logs (
    id uuid default gen_random_uuid() primary key,
    action text not null,
    details jsonb,
    executor_id text,
    created_at timestamp with time zone default now()
);

-- Initial Data (Seeding)
insert into public.banxico_indicators (key, name, value, unit) values
('inflation', 'Inflación Anual', 4.50, '%'),
('interest_rate', 'Tasa de Interés (TIIE)', 11.25, '%'),
('reserves', 'Reservas Internacionales', 200000.00, 'M USD'),
('exchange_rate', 'Tipo de Cambio (FIX)', 17.50, 'MXN')
on conflict (key) do nothing;

-- Security Policies (RLS)
alter table public.banxico_auth_codes enable row level security;
alter table public.banxico_indicators enable row level security;
alter table public.banxico_logs enable row level security;

create policy "Service Access" on public.banxico_auth_codes for all using (true);
create policy "Public Read" on public.banxico_indicators for select using (true);
create policy "Bot Write" on public.banxico_indicators for all using (true);
create policy "Log Access" on public.banxico_logs for all using (true);
