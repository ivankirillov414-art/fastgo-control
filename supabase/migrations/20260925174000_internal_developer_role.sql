begin;

alter table public.workshop_members
  drop constraint if exists workshop_members_role_check;

alter table public.workshop_members
  add constraint workshop_members_role_check
  check(role in ('developer','owner','admin','receiver','manager','mechanic'));

create unique index if not exists workshop_members_one_developer
  on public.workshop_members((role))
  where role='developer';

update public.workshop_members
set role='developer'
where profile_id = (
  select profile_id
  from public.workshop_members
  where role='owner' and active
  order by created_at asc
  limit 1
)
and role='owner';

commit;
