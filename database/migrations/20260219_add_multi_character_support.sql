-- Migration: Add Multi-Character Support (Updated Step 88)
-- Date: 2026-02-19
-- Description: Adds character_id to DNI, Financial tables (Loans, Savings, Invoices), and Cards.

-- 1. Create table to track active character for each user
create table if not exists public.user_active_character (
    user_id text primary key, -- Changed from discord_user_id to user_id for consistency
    active_character_id integer default 1 check (active_character_id in (1, 2)),
    updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.user_active_character enable row level security;
create policy "Public Read Active Char" on public.user_active_character for select using (true);
create policy "Bot Write Active Char" on public.user_active_character for all using (true);

-- 2. Modify citizen_dni to support multiple characters
-- We need to handle potential primary key conflicts safely.
-- Assuming 'id' is SERIAL/UUID PK, we add a UNIQUE constraint on (user_id, character_id).
-- If (user_id) was UNIQUE, we drop that constraint.
alter table public.citizen_dni drop constraint if exists citizen_dni_user_id_key; 
alter table public.citizen_dni 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- Ensure uniqueness per character slot
alter table public.citizen_dni 
add constraint citizen_dni_user_character_unique unique (user_id, character_id);

-- 3. Modify Financial Tables (Loans, Savings, Invoices)
-- Loans
alter table public.loans 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- Savings
alter table public.savings_accounts 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- Invoices
alter table public.invoices 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- 4. Modify Cards (Credit/Debit) - Implicit Requirement for Financial Records
-- Credit Cards
alter table public.credit_cards 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- Debit Cards
alter table public.debit_cards 
add column if not exists character_id integer default 1 check (character_id in (1, 2));

-- 5. Helper Function
create or replace function get_active_character(target_user_id text)
returns integer as $$
declare
    char_id integer;
begin
    select active_character_id into char_id
    from public.user_active_character
    where user_id = target_user_id;
    
    return coalesce(char_id, 1);
end;
$$ language plpgsql security definer;
