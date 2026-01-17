-- Add columns for Feedback & Activity Tracking
alter table public.tickets add column if not exists rating int;
alter table public.tickets add column if not exists feedback_comment text;
alter table public.tickets add column if not exists last_active_at timestamp with time zone default timezone('utc'::text, now());

-- Tags System Table
create table if not exists public.ticket_tags (
    id uuid default uuid_generate_v4() primary key,
    guild_id varchar not null,
    name varchar not null,
    content text not null,
    created_by varchar,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Tags
alter table public.ticket_tags enable row level security;
create policy "Enable all for service role" on public.ticket_tags for all using ( auth.role() = 'service_role' );
