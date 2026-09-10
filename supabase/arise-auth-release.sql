-- Apply after arise-release.sql, only to Personal RPG. No automatic legacy claims.
begin;
create table if not exists public.arise_accounts(
 user_id uuid primary key references auth.users(id),
 device_id text not null unique default gen_random_uuid()::text,
 created_at timestamptz not null default now()
);
create table if not exists public.arise_migration_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 legacy_device_id text not null check(legacy_device_id ~ '^[a-zA-Z0-9_-]{16,80}$'),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(user_id,legacy_device_id)
);
create unique index if not exists arise_one_approved_owner
 on public.arise_migration_requests(legacy_device_id) where status='approved';
create table if not exists public.arise_physical_sessions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 device_id text not null, quest_index integer not null,
 goal integer not null check(goal between 1 and 1000), mode text not null check(mode in ('reps','hold')),
 started_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 completed_at timestamptz, reps integer,valid_ms integer,observations integer
);
create index if not exists arise_sessions_owner_created on public.arise_physical_sessions(user_id,started_at desc);
alter table public.arise_accounts enable row level security;
alter table public.arise_migration_requests enable row level security;
alter table public.arise_physical_sessions enable row level security;
revoke all on public.arise_accounts,public.arise_migration_requests,public.arise_physical_sessions from anon,authenticated;
grant all on public.arise_accounts,public.arise_migration_requests,public.arise_physical_sessions to service_role;

create or replace function public.arise_account_device(p_user_id uuid)
returns text language plpgsql security invoker set search_path=public,pg_temp as $body$
declare result text;
begin
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null and not coalesce(is_anonymous,false))
   then raise exception 'email_verification_required'; end if;
 insert into public.arise_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select device_id into result from public.arise_accounts where user_id=p_user_id;
 return result;
end $body$;

-- Only an operator may call this, AFTER independently confirming ownership.
-- Knowing a legacy key or controlling a new email is NOT sufficient verification.
create or replace function public.arise_approve_migration(p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $body$
declare req public.arise_migration_requests; target text; old_key text; result public.rpg_progress;
begin
 select * into req from public.arise_migration_requests where id=p_request_id for update;
 if not found or req.status<>'pending' then raise exception 'migration_not_pending'; end if;
 target:=public.arise_account_device(req.user_id); old_key:=req.legacy_device_id;
 if target=old_key then raise exception 'invalid_migration'; end if;
 -- Deterministic order prevents cycles when multiple operations are concurrent.
 perform pg_advisory_xact_lock(hashtextextended('arise:'||least(target,old_key),0));
 perform pg_advisory_xact_lock(hashtextextended('arise:'||greatest(target,old_key),0));
 if exists(select 1 from public.arise_accounts where device_id=old_key)
   or exists(select 1 from public.arise_migration_requests where legacy_device_id=old_key and status='approved')
   then raise exception 'migration_already_claimed'; end if;
 if not exists(select 1 from public.rpg_progress where device_id=old_key)
   and not exists(select 1 from public.quest_evidence where device_id=old_key)
   then raise exception 'legacy_progress_missing'; end if;
 -- Keep original quest rows as an archive; merge without downgrading confirmations.
 insert into public.quest_evidence(device_id,quest_index,quest_title,file_path,file_name,mime_type,file_size,status,review_note,created_at,reviewed_at)
 select target,quest_index,quest_title,file_path,file_name,mime_type,file_size,status,review_note,created_at,reviewed_at
 from public.quest_evidence where device_id=old_key
 on conflict(device_id,quest_index) do update set
   status=excluded.status,review_note=excluded.review_note,file_path=excluded.file_path,
   file_name=excluded.file_name,mime_type=excluded.mime_type,file_size=excluded.file_size,reviewed_at=excluded.reviewed_at
 where quest_evidence.status<>'accepted' and excluded.status='accepted';
 update public.quest_evidence_parts set device_id=target where device_id=old_key;
 update public.daily_sources set device_id=target where device_id=old_key;
 update public.daily_instances set device_id=target where device_id=old_key;
 update public.daily_evidence set device_id=target where device_id=old_key;
 update public.push_subscriptions set device_id=target where device_id=old_key;
 update public.arise_migration_requests set status='approved',reviewed_at=now() where id=p_request_id;
 result:=public.sync_rpg_progress_from_evidence(target);
 return jsonb_build_object('status','approved','xp',result.xp);
end $body$;

create or replace function public.arise_finish_physical(p_user_id uuid,p_session_id uuid,p_reps integer,p_valid_ms integer,p_observations integer,p_title text)
returns public.quest_evidence language plpgsql security invoker set search_path=public,pg_temp as $body$
declare session public.arise_physical_sessions; result public.quest_evidence; elapsed_ms numeric; previous_index integer;
begin
 select * into session from public.arise_physical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'invalid_session'; end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||session.device_id,0));
 if session.completed_at is not null then
   select * into result from public.quest_evidence where device_id=session.device_id and quest_index=session.quest_index;
   return result;
 end if;
 if session.expires_at<now() then raise exception 'session_expired'; end if;
 elapsed_ms:=extract(epoch from now()-session.started_at)*1000;
 if p_reps is null or p_valid_ms is null or p_observations is null
   or p_reps<0 or p_reps>1000 or p_valid_ms<0 or p_valid_ms>900000 or p_observations<1 or p_observations>10000
   then raise exception 'invalid_result'; end if;
 if session.mode='hold' then
   if p_valid_ms<session.goal*1000 or elapsed_ms<p_valid_ms or p_observations<session.goal*3 then raise exception 'insufficient_result'; end if;
 else
   if p_reps<session.goal or elapsed_ms<session.goal*600 or p_observations<session.goal*4 then raise exception 'insufficient_result'; end if;
 end if;
 previous_index:=session.quest_index-1;
 if (session.quest_index-52)%6<>0 and not exists(select 1 from public.quest_evidence where device_id=session.device_id and quest_index=previous_index and status='accepted')
   then raise exception 'quest_locked'; end if;
 update public.arise_physical_sessions set completed_at=now(),reps=p_reps,valid_ms=p_valid_ms,observations=p_observations where id=p_session_id;
 result:=public.arise_record_quest(session.device_id,session.quest_index,p_title,'local-camera/'||session.id::text,
  'Локальная камера · числовой результат','application/json',0,'accepted',
  'Результат локального счётчика. Видео не передавалось; сервер не проверяет технику упражнения и достоверность кадров.');
 return result;
end $body$;

create or replace function public.arise_training_days(p_user_id uuid)
returns date[] language sql stable security invoker set search_path=public,pg_temp as $body$
 select coalesce(array_agg(day order by day desc),'{}'::date[]) from
 (select distinct (completed_at at time zone 'Asia/Yekaterinburg')::date as day
  from public.arise_physical_sessions where user_id=p_user_id and completed_at is not null
  order by day desc limit 366) days;
$body$;
revoke all on function public.arise_training_days(uuid) from public,anon,authenticated;
grant execute on function public.arise_training_days(uuid) to service_role;
revoke all on function public.arise_account_device(uuid) from public,anon,authenticated;
revoke all on function public.arise_approve_migration(uuid) from public,anon,authenticated;
revoke all on function public.arise_finish_physical(uuid,uuid,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.arise_account_device(uuid) to service_role;
grant execute on function public.arise_approve_migration(uuid) to service_role;
grant execute on function public.arise_finish_physical(uuid,uuid,integer,integer,integer,text) to service_role;
commit;
