  -- Create Citizens Table
  create table if not exists citizens (
    id uuid default uuid_generate_v4() primary key,
    dni text unique not null,
    full_name text not null,
    phone text,
    created_at timestamp with time zone default timezone('utc'::text, now())
  );

  -- Create Credit Cards Table
  create table if not exists credit_cards (
    id uuid default uuid_generate_v4() primary key,
    citizen_id uuid references citizens(id) on delete cascade not null,
    card_type text check (card_type in ('NMX Start', 'NMX Básica', 'NMX Plus', 'NMX Plata', 'NMX Oro', 'NMX Rubí', 'NMX Black', 'NMX Diamante')) not null,
    credit_limit numeric not null,
    current_balance numeric default 0,
    interest_rate numeric not null, -- Weekly interest percentage
    cut_day integer default 7,
    has_loans boolean default false,
    status text check (status in ('active', 'frozen', 'cancelled')) default 'active',
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
  );

  -- Enable RLS
  alter table citizens enable row level security;
  alter table credit_cards enable row level security;

  -- Policies for Citizens
  drop policy if exists "Staff can view citizens" on citizens;
  create policy "Staff can view citizens"
    on citizens for select
    using ( auth.role() = 'authenticated' );

  drop policy if exists "Staff can insert citizens" on citizens;
  create policy "Staff can insert citizens"
    on citizens for insert
    with check ( auth.role() = 'authenticated' );

  drop policy if exists "Staff can update citizens" on citizens;
  create policy "Staff can update citizens"
    on citizens for update
    using ( auth.role() = 'authenticated' );

  -- Policies for Credit Cards
  drop policy if exists "Staff can view credit cards" on credit_cards;
  create policy "Staff can view credit cards"
    on credit_cards for select
    using ( auth.role() = 'authenticated' );

  drop policy if exists "Staff can manage credit cards" on credit_cards;
  create policy "Staff can manage credit cards"
    on credit_cards for all
    using ( auth.role() = 'authenticated' );
