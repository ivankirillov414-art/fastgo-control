-- Diagnostic heartbeat only: no repair or customer content.
create table if not exists public.workshop_app_versions (
 actor_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 version text not null check(version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
 latest_version text,
 update_state text not null default 'unknown',
 last_seen timestamptz not null default now(),
 primary key(actor_id,device_id)
);
alter table public.workshop_app_versions enable row level security;
revoke all on public.workshop_app_versions from public,anon,authenticated;
grant select,insert,update,delete on public.workshop_app_versions to service_role;
