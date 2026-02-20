-- Phase 5: Advanced Financial Services

-- 1. Loans Table
create table if not exists loans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  amount numeric not null,
  interest_rate numeric default 5.0, -- 5% fixed fee or weekly
  total_repayment numeric generated always as (amount * (1 + interest_rate/100)) stored,
  due_date timestamptz not null,
  status text check (status in ('active', 'paid', 'overdue', 'defaulted')) default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Savings Accounts
create table if not exists savings_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  balance numeric default 0 check (balance >= 0),
  interest_rate numeric default 2.0, -- 2% weekly APY-ish
  type text check (type in ('standard', 'plazo_fijo')) default 'standard',
  locked_until timestamptz, -- For 'plazo_fijo'
  created_at timestamptz default now(),
  last_interest_payment timestamptz
);

-- 3. Invoices (Facturación)
create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  issuer_id uuid references auth.users not null, -- Who creates the invoice (Company Owner or Freelancer)
  receiver_id uuid references auth.users, -- Who pays (User or Company) (Optional if public link?) -> For now mandatory
  company_id uuid references companies(id), -- Optional: If issued by a company
  amount numeric not null check (amount > 0),
  concept text not null,
  status text check (status in ('pending', 'paid', 'cancelled')) default 'pending',
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- 4. Notifications (Real-time Polling)
create table if not exists notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  message text not null,
  type text check (type in ('info', 'success', 'warning', 'error', 'payment')) default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

-- RLS Policies
alter table loans enable row level security;
alter table savings_accounts enable row level security;
alter table invoices enable row level security;
alter table notifications enable row level security;

-- Policies (Simplified for development, refine for production)
create policy "Users can view own loans" on loans for select using (auth.uid() = user_id);
create policy "Users can view own savings" on savings_accounts for select using (auth.uid() = user_id);
create policy "Users can view own invoices" on invoices for select using (auth.uid() = issuer_id or auth.uid() = receiver_id);
create policy "Users can view own notifications" on notifications for select using (auth.uid() = user_id);
