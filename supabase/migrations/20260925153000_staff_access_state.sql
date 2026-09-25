begin;

alter table public.workshop_members
  add column if not exists approved_at timestamptz;

update public.workshop_members
set approved_at=created_at
where active and approved_at is null;

create or replace function public.fastgo_stamp_workshop_member_approval()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.active and new.approved_at is null then
    new.approved_at=now();
  end if;
  return new;
end
$$;

drop trigger if exists fastgo_workshop_member_approval_stamp on public.workshop_members;
create trigger fastgo_workshop_member_approval_stamp
before insert or update of active on public.workshop_members
for each row execute function public.fastgo_stamp_workshop_member_approval();

commit;
