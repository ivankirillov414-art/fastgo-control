-- ARISE release SQL. Apply only to Personal RPG (cnjmbzobtvfjqhedhwpj).
-- Preserves all progress/evidence rows. No data deletion or identity rotation.
-- Deploy the accompanying handlers after this transaction, then publish the frontend.
begin;

-- Legacy browser uploads have been superseded by server-side, device-scoped handlers.
drop policy if exists "personal rpg evidence update objects" on storage.objects;
drop policy if exists "personal rpg evidence read objects" on storage.objects;
drop policy if exists "personal rpg evidence upload" on storage.objects;
drop policy if exists "personal rpg evidence insert" on public.quest_evidence;
drop policy if exists "personal rpg evidence read" on public.quest_evidence;
revoke all on public.quest_evidence from anon, authenticated;
revoke all on public.quest_evidence_parts from anon, authenticated;
revoke all on public.rpg_progress from anon, authenticated;
revoke all on public.daily_instances from anon, authenticated;
revoke all on public.daily_sources from anon, authenticated;
revoke all on public.daily_evidence from anon, authenticated;

create or replace function public.sync_rpg_progress_from_evidence(p_device_id text)
returns public.rpg_progress language plpgsql security invoker set search_path = public, pg_temp
as $body$
declare
  q integer[]; quest_xp integer; dxp integer;
  rewards integer[] := array[40,50,60,80,90,180,100,120,130,140,150,160,180,350,220,230,250,260,280,300,550,320,350,280,350,380,400,420,450,750,300,400,550,650,500,900,2000,30,40,50,60,60,60,80,90,90,100,160,100,120,140,250];
  result public.rpg_progress;
begin
  if p_device_id !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'invalid_device'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
  select coalesce(array_agg(quest_index order by quest_index),'{}'::integer[]) into q
    from public.quest_evidence where device_id=p_device_id and status='accepted';
  select coalesce(sum(rewards[i+1]),0) into quest_xp from unnest(q) i
    where i>=0 and i<array_length(rewards,1);
  select coalesce(sum(xp),0) into dxp from public.daily_instances
    where device_id=p_device_id and status='completed' and xp_awarded=true;
  insert into public.rpg_progress(device_id,xp,daily_xp,completed_quests,updated_at)
    values(p_device_id,quest_xp+dxp,dxp,q,now())
    on conflict(device_id) do update set xp=excluded.xp,daily_xp=excluded.daily_xp,
      completed_quests=excluded.completed_quests,updated_at=now()
    returning * into result;
  return result;
end $body$;

create or replace function public.arise_daily_list(p_device_id text,p_date date,p_expired boolean)
returns setof public.daily_instances language plpgsql security invoker set search_path=public,pg_temp
as $body$
begin
  if p_device_id !~ '^[a-zA-Z0-9_-]{16,80}$' then raise exception 'invalid_device'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
  update public.daily_instances set status='failed'
    where device_id=p_device_id and status in ('active','rejected')
    and (daily_date<p_date or (p_expired and daily_date=p_date));
  if not p_expired then
    if not exists(select 1 from public.daily_sources where device_id=p_device_id) then
      insert into public.daily_sources(device_id,source_type,title,details,xp,verification_mode) values
        (p_device_id,'work','План работы на день','Выполни один конкретный рабочий результат и приложи доказательство.',25,'photo_or_file'),
        (p_device_id,'learning','Уровень обучения','Пройди небольшой уровень активной ветки навыка и приложи результат.',30,'screenshot_or_file'),
        (p_device_id,'project','Шаг проекта','Сделай один выполнимый шаг инженерного проекта и покажи результат.',35,'photo_or_3d');
    end if;
    insert into public.daily_instances(device_id,source_id,daily_date,source_type,title,details,xp,verification_mode)
      select device_id,id,p_date,source_type,title,details,xp,verification_mode
      from public.daily_sources where device_id=p_device_id and active=true
      on conflict(device_id,source_id,daily_date) do nothing;
  end if;
  return query select * from public.daily_instances
    where device_id=p_device_id and daily_date=p_date order by id;
end $body$;

create or replace function public.arise_add_daily(p_device_id text,p_title text,p_details text,p_type text,p_repeat boolean,p_date date)
returns public.daily_instances language plpgsql security invoker set search_path=public,pg_temp
as $body$
declare source public.daily_sources; result public.daily_instances; reward integer; mode text;
begin
  if p_device_id !~ '^[a-zA-Z0-9_-]{16,80}$' or length(trim(p_title)) not between 1 and 160
    or length(trim(p_details)) not between 1 and 500 or p_type not in ('work','learning','project')
    then raise exception 'invalid_quest'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
  if (select count(*) from public.daily_instances where device_id=p_device_id and daily_date=p_date)>=30
    then raise exception 'daily_limit'; end if;
  reward:=case p_type when 'learning' then 30 when 'project' then 35 else 25 end;
  mode:=case p_type when 'learning' then 'screenshot_or_file' when 'project' then 'photo_or_3d' else 'photo_or_file' end;
  insert into public.daily_sources(device_id,source_type,title,details,xp,active,verification_mode)
    values(p_device_id,p_type,trim(p_title),trim(p_details),reward,p_repeat,mode) returning * into source;
  insert into public.daily_instances(device_id,source_id,daily_date,source_type,title,details,xp,verification_mode)
    values(p_device_id,source.id,p_date,p_type,source.title,source.details,reward,mode) returning * into result;
  return result;
end $body$;

create or replace function public.arise_record_quest(p_device_id text,p_index integer,p_title text,p_path text,p_name text,p_mime text,p_size bigint,p_status text,p_note text)
returns public.quest_evidence language plpgsql security invoker set search_path=public,pg_temp
as $body$
declare result public.quest_evidence;
begin
  if p_device_id !~ '^[a-zA-Z0-9_-]{16,80}$' or p_index not between 0 and 51
    or p_status not in ('pending','accepted','rejected') then raise exception 'invalid_quest'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
  select * into result from public.quest_evidence where device_id=p_device_id and quest_index=p_index for update;
  if result.status='accepted' then return result; end if;
  insert into public.quest_evidence(device_id,quest_index,quest_title,file_path,file_name,mime_type,file_size,status,review_note,reviewed_at)
    values(p_device_id,p_index,p_title,p_path,p_name,p_mime,p_size,p_status,p_note,case when p_status<>'pending' then now() end)
    on conflict(device_id,quest_index) do update set file_path=excluded.file_path,file_name=excluded.file_name,
      mime_type=excluded.mime_type,file_size=excluded.file_size,quest_title=excluded.quest_title,status=excluded.status,
      review_note=excluded.review_note,reviewed_at=excluded.reviewed_at returning * into result;
  return result;
end $body$;

create or replace function public.arise_record_daily(p_device_id text,p_daily_id bigint,p_date date,p_path text,p_name text,p_mime text,p_size bigint,p_status text,p_note text)
returns public.daily_evidence language plpgsql security invoker set search_path=public,pg_temp
as $body$
declare daily public.daily_instances; result public.daily_evidence;
begin
  if p_device_id !~ '^[a-zA-Z0-9_-]{16,80}$' or p_status not in ('pending','accepted','rejected')
    then raise exception 'invalid_quest'; end if;
  perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
  select * into daily from public.daily_instances where id=p_daily_id and device_id=p_device_id and daily_date=p_date for update;
  if not found then raise exception 'daily_not_active'; end if;
  insert into public.daily_evidence(device_id,daily_instance_id,file_path,file_name,mime_type,file_size,status,review_note,reviewed_at)
    values(p_device_id,p_daily_id,p_path,p_name,p_mime,p_size,p_status,p_note,case when p_status<>'pending' then now() end)
    returning * into result;
  if daily.status<>'completed' then
    update public.daily_instances set
      status=case p_status when 'accepted' then 'completed' when 'rejected' then 'rejected' else 'pending_review' end,
      xp_awarded=(p_status='accepted'),completed_at=case when p_status='accepted' then now() end
      where id=p_daily_id and device_id=p_device_id;
  end if;
  return result;
end $body$;

-- Only trusted server handlers call these functions. Device id is never an anon SQL capability.
revoke all on function public.sync_rpg_progress_from_evidence(text) from public,anon,authenticated;
revoke all on function public.arise_daily_list(text,date,boolean) from public,anon,authenticated;
revoke all on function public.arise_add_daily(text,text,text,text,boolean,date) from public,anon,authenticated;
revoke all on function public.arise_record_quest(text,integer,text,text,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.arise_record_daily(text,bigint,date,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.sync_rpg_progress_from_evidence(text) to service_role;
grant execute on function public.arise_daily_list(text,date,boolean) to service_role;
grant execute on function public.arise_add_daily(text,text,text,text,boolean,date) to service_role;
grant execute on function public.arise_record_quest(text,integer,text,text,text,text,bigint,text,text) to service_role;
grant execute on function public.arise_record_daily(text,bigint,date,text,text,text,bigint,text,text) to service_role;
create index if not exists arise_parts_device_created on public.quest_evidence_parts(device_id,created_at desc);
create index if not exists arise_daily_evidence_device_created on public.daily_evidence(device_id,created_at desc);
create index if not exists arise_daily_device_date on public.daily_instances(device_id,daily_date);
commit;
