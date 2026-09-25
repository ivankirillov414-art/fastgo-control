begin;

create table if not exists public.workshop_role_permissions (
  role text primary key check(role in ('owner','admin','receiver','manager','mechanic')),
  can_mark_ready boolean not null default false,
  can_issue boolean not null default false,
  can_cancel boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.workshop_role_permissions(role,can_mark_ready,can_issue,can_cancel)
values
  ('owner',true,true,true),
  ('admin',true,true,true),
  ('receiver',false,true,true),
  ('manager',true,false,true),
  ('mechanic',true,false,false)
on conflict(role) do nothing;

alter table public.workshop_role_permissions enable row level security;
revoke all on public.workshop_role_permissions from anon,authenticated;
grant all on public.workshop_role_permissions to service_role;

commit;
