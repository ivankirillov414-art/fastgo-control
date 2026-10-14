create table if not exists public.workshop_operations_settings(id integer primary key check(id=1),config jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now());
alter table public.workshop_operations_settings enable row level security;
revoke all on public.workshop_operations_settings from public,anon,authenticated;
grant select,insert,update on public.workshop_operations_settings to service_role;
insert into public.workshop_operations_settings(id) values(1) on conflict do nothing;
