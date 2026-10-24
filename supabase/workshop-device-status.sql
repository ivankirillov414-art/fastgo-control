-- Authenticated, device-bound installation receipts. Never store auth tokens here.
create table if not exists public.workshop_device_status (
 device_id uuid not null references public.workshop_warehouse_devices(id) on delete cascade,
 app text not null check (app in ('desktop','warehouse','tsd')),
 version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
 station_id uuid not null references public.workshop_warehouse_devices(id),
 pending_documents integer check (pending_documents >= 0),
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object' and octet_length(details::text)<4096),
 last_seen timestamptz not null default now(),
 primary key(device_id,app)
);
alter table public.workshop_device_status enable row level security;
revoke all on public.workshop_device_status from public,anon,authenticated;
grant select,insert,update,delete on public.workshop_device_status to service_role;
