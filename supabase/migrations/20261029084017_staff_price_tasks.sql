create table if not exists public.workshop_staff_tasks (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
 assignee_id uuid not null references public.workshop_members(profile_id),
 created_by uuid references public.workshop_members(profile_id),
 title text not null check (length(title) between 1 and 200),
 description text not null default '' check (length(description)<=3000),
 scopes text[] not null check (cardinality(scopes) between 1 and 3 and scopes <@ array['parts','equipment','works']::text[]),
 reviewed_scopes text[] not null default '{}' check (reviewed_scopes <@ scopes),
 status text not null default 'open' check (status in ('open','done','cancelled')),
 revision integer not null default 1 check (revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 notice_device uuid,
 notice_claimed_at timestamptz,
 notice_posted_at timestamptz,
 notice_opened_at timestamptz
);
create index if not exists workshop_staff_tasks_assignee on public.workshop_staff_tasks(assignee_id,status,created_at);
alter table public.workshop_staff_tasks enable row level security;
revoke all on public.workshop_staff_tasks from anon,authenticated;
grant select on public.workshop_staff_tasks to authenticated;
grant all on public.workshop_staff_tasks to service_role;
create policy workshop_staff_task_read on public.workshop_staff_tasks for select to authenticated using (
 exists(select 1 from public.workshop_members m where m.profile_id=(select auth.uid()) and m.active
 and (workshop_staff_tasks.assignee_id=m.profile_id or m.role in ('developer','owner','admin')))
);

create table public.workshop_task_devices (
 id uuid primary key,
 profile_id uuid not null references public.workshop_members(profile_id),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index workshop_task_devices_profile on public.workshop_task_devices(profile_id);
alter table public.workshop_task_devices enable row level security;
revoke all on public.workshop_task_devices from anon,authenticated;
grant all on public.workshop_task_devices to service_role;

-- The API authenticates the actor; only the service role may call these functions.
create or replace function public.workshop_claim_task_notices(p_actor uuid,p_device uuid)
returns setof public.workshop_staff_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_device is null or not exists(select 1 from workshop_members where profile_id=p_actor and active) then raise exception 'Нет доступа' using errcode='42501';end if;
 return query update workshop_staff_tasks t set notice_device=p_device,notice_claimed_at=coalesce(t.notice_claimed_at,now())
 where t.id in (select x.id from workshop_staff_tasks x where x.assignee_id=p_actor and x.status='open'
 and x.notice_posted_at is null and x.notice_opened_at is null and (x.notice_device is null or x.notice_device=p_device)
 order by x.created_at,x.id limit 10 for update skip locked) returning t.*;
end $$;
revoke all on function public.workshop_claim_task_notices(uuid,uuid) from public,anon,authenticated;
grant execute on function public.workshop_claim_task_notices(uuid,uuid) to service_role;

create or replace function public.workshop_update_staff_task(p_actor uuid,p_id uuid,p_revision integer,p_scopes text[],p_status text)
returns public.workshop_staff_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare task workshop_staff_tasks; privileged boolean;begin
 select exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('developer','owner','admin')) into privileged;
 if not exists(select 1 from workshop_members where profile_id=p_actor and active) then raise exception 'Нет доступа' using errcode='42501';end if;
 select * into task from workshop_staff_tasks where id=p_id for update;
 if not found or (task.assignee_id<>p_actor and not privileged) then raise exception 'Задача не найдена' using errcode='42501';end if;
 if task.revision<>p_revision then raise exception 'Задача уже изменена. Обновите её.' using errcode='40001';end if;
 if p_status not in ('open','done','cancelled') or p_scopes is null or not (p_scopes <@ task.scopes) then raise exception 'Проверьте отметки задачи';end if;
 if task.status<>'open' and not privileged then raise exception 'Задача закрыта';end if;
 if p_status='cancelled' and not privileged then raise exception 'Отменить задачу может руководитель' using errcode='42501';end if;
 if p_status='done' and not (task.scopes <@ p_scopes) then raise exception 'Подтвердите проверку всех справочников';end if;
 update workshop_staff_tasks set reviewed_scopes=p_scopes,status=p_status,revision=revision+1,updated_at=now(),
 completed_at=case when p_status='done' then coalesce(completed_at,now()) else null end where id=p_id returning * into task;
 return task;
end $$;
revoke all on function public.workshop_update_staff_task(uuid,uuid,integer,text[],text) from public,anon,authenticated;
grant execute on function public.workshop_update_staff_task(uuid,uuid,integer,text[],text) to service_role;

-- Recheck the delegated task inside the same transaction as a price mutation.
do $guard$
declare definition text; marker text:='select * into st from workshop_native_state where id=1 for update;';begin
 select pg_get_functiondef('public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb)'::regprocedure) into definition;
 if position('staff_price_save' in definition)=0 then
  if position(marker in definition)=0 then raise exception 'Native commit changed; review before installing task guard';end if;
  definition:=replace(definition,marker,$taskguard$
 if p_action='staff_price_save' then
 perform 1 from public.workshop_staff_tasks t join public.workshop_members m on m.profile_id=p_actor and m.active
 where t.id=(p_result->>'task_id')::uuid and t.status='open' and (t.assignee_id=p_actor or m.role in ('developer','owner','admin'))
 and (p_result->>'scope')=any(t.scopes) for share of t;
 if not found then raise exception 'Задача не даёт права изменять эти цены' using errcode='42501';end if;
 end if;
 select * into st from workshop_native_state where id=1 for update;
 $taskguard$);
  execute definition;
 end if;
end $guard$;
