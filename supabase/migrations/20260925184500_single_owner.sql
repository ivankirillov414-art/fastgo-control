create unique index if not exists workshop_members_one_owner
on public.workshop_members((role))
where role='owner';