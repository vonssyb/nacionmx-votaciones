-- Tabla para Usuarios Bloqueados del Soporte
create table if not exists public.ticket_blacklist (
    user_id varchar primary key,
    reason text,
    banned_at timestamp with time zone default timezone('utc'::text, now()),
    banned_by varchar
);

-- RLS
alter table public.ticket_blacklist enable row level security;
create policy "Enable all for service role" on public.ticket_blacklist for all using ( auth.role() = 'service_role' );
