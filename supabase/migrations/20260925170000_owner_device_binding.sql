begin;

create table if not exists public.workshop_owner_devices (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_token uuid not null,
  label text not null default 'iPhone 13',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key(profile_id, device_token)
);

create unique index if not exists workshop_owner_devices_one_active
  on public.workshop_owner_devices(profile_id)
  where active;

alter table public.workshop_owner_devices enable row level security;
revoke all on public.workshop_owner_devices from anon, authenticated;
grant all on public.workshop_owner_devices to service_role;

commit;
