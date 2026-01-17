-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- TABLE: ticket_panels
-- Stores configuration for ticket creation panels (embeds with buttons/menus)
create table if not exists public.ticket_panels (
    id uuid default uuid_generate_v4() primary key,
    guild_id varchar not null,
    channel_id varchar not null,
    message_id varchar not null,
    title varchar not null,
    description text,
    button_label varchar not null,
    button_style varchar default 'Primary', -- Primary, Secondary, Success, Danger
    emoji varchar,
    category_id varchar, -- Discord Category ID to create tickets in
    support_role_id varchar, -- Role ID that can view/manage created tickets
    naming_format varchar default 'ticket-{username}', -- e.g. ticket-gonzalez
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TABLE: tickets
-- Stores instances of created tickets
create table if not exists public.tickets (
    id uuid default uuid_generate_v4() primary key,
    panel_id uuid references public.ticket_panels(id) on delete set null,
    guild_id varchar not null,
    channel_id varchar not null,
    creator_id varchar not null,
    claimed_by_id varchar,
    status varchar default 'OPEN', -- OPEN, CLOSED
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    closed_at timestamp with time zone,
    transcript_url text,
    close_reason text
);

-- RLS Policies (Optional but recommended, though bot uses Service Role)
alter table public.ticket_panels enable row level security;
alter table public.tickets enable row level security;

-- Allow full access to service role (default, but explicit is good)
create policy "Enable all for service role" on public.ticket_panels
    for all using ( auth.role() = 'service_role' );

create policy "Enable all for service role" on public.tickets
    for all using ( auth.role() = 'service_role' );
