-- Apply after auth/tree/projects releases. Preserve every daily snapshot and earned XP.
begin;
alter table public.daily_sources add column if not exists is_template boolean not null default false;
alter table public.daily_sources add column if not exists physical_quest_index integer;
alter table public.daily_instances add column if not exists physical_quest_index integer;
alter table public.arise_physical_sessions add column if not exists daily_id bigint references public.daily_instances(id);
update public.daily_sources set is_template=true where active=true;

create or replace function public.arise_add_daily_v2(p_device_id text,p_title text,p_details text,p_type text,p_repeat boolean,p_date date,p_physical_index integer)
returns public.daily_instances language plpgsql security invoker set search_path=public,pg_temp as $body$
declare source public.daily_sources;result public.daily_instances;reward integer;mode text;
begin
 if p_device_id!~'^[a-zA-Z0-9_-]{16,80}$' or p_title is null or length(trim(p_title)) not between 1 and 160
  or p_details is null or length(trim(p_details)) not between 1 and 500 or p_type is null
  or p_type not in ('work','learning','project','physical') then raise exception 'invalid_quest';end if;
 if p_type='physical' and (p_physical_index is null or p_physical_index not in (52,58,64,70)) then raise exception 'invalid_quest';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
 if (select count(*) from public.daily_instances where device_id=p_device_id and daily_date=p_date)>=30
  or (p_repeat and (select count(*) from public.daily_sources where device_id=p_device_id and active)>=30) then raise exception 'daily_limit';end if;
 reward:=case p_type when 'learning' then 30 when 'project' then 35 else 25 end;
 mode:=case p_type when 'physical' then 'camera' when 'learning' then 'screenshot_or_file' when 'project' then 'photo_or_3d' else 'photo_or_file' end;
 insert into public.daily_sources(device_id,source_type,title,details,xp,active,verification_mode,is_template,physical_quest_index)
  values(p_device_id,p_type,trim(p_title),trim(p_details),reward,p_repeat,mode,p_repeat,case when p_type='physical' then p_physical_index end) returning * into source;
 insert into public.daily_instances(device_id,source_id,daily_date,source_type,title,details,xp,verification_mode,physical_quest_index)
  values(p_device_id,source.id,p_date,p_type,source.title,source.details,reward,mode,source.physical_quest_index) returning * into result;
 return result;
end $body$;

create or replace function public.arise_save_daily_source(p_device_id text,p_id bigint,p_title text,p_details text,p_active boolean,p_physical_index integer)
returns public.daily_sources language plpgsql security invoker set search_path=public,pg_temp as $body$
declare result public.daily_sources;
begin
 if p_title is null or length(trim(p_title)) not between 1 and 160 or p_details is null or length(trim(p_details)) not between 1 and 500 or p_active is null then raise exception 'invalid_quest';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
 select * into result from public.daily_sources where id=p_id and device_id=p_device_id and is_template for update;
 if not found then raise exception 'template_not_found';end if;
 if result.source_type='physical' and coalesce(p_physical_index,result.physical_quest_index,-1) not in (52,58,64,70) then raise exception 'invalid_quest';end if;
 if p_active and not result.active and (select count(*) from public.daily_sources where device_id=p_device_id and active)>=30 then raise exception 'daily_limit';end if;
 update public.daily_sources set title=trim(p_title),details=trim(p_details),active=p_active,physical_quest_index=case when result.source_type='physical' then coalesce(p_physical_index,result.physical_quest_index) end where id=p_id and device_id=p_device_id returning * into result;
 return result;
end $body$;

create or replace function public.arise_daily_list(p_device_id text,p_date date,p_expired boolean)
returns setof public.daily_instances language plpgsql security invoker set search_path=public,pg_temp as $body$
begin
 if p_device_id!~'^[a-zA-Z0-9_-]{16,80}$' then raise exception 'invalid_device';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
 update public.daily_instances set status='failed' where device_id=p_device_id and status in ('active','rejected') and (daily_date<p_date or (p_expired and daily_date=p_date));
 if not p_expired then
  if not exists(select 1 from public.daily_sources where device_id=p_device_id) then
   insert into public.daily_sources(device_id,source_type,title,details,xp,verification_mode,is_template)values
    (p_device_id,'work','План работы на день','Выполни один конкретный рабочий результат и приложи доказательство.',25,'photo_or_file',true),
    (p_device_id,'learning','Уровень обучения','Пройди небольшой уровень активной ветки навыка и приложи результат.',30,'screenshot_or_file',true),
    (p_device_id,'project','Шаг проекта','Сделай один выполнимый шаг инженерного проекта и покажи результат.',35,'photo_or_3d',true);
  end if;
  insert into public.daily_instances(device_id,source_id,daily_date,source_type,title,details,xp,verification_mode,physical_quest_index)
   select device_id,id,p_date,source_type,title,details,xp,verification_mode,physical_quest_index from public.daily_sources
    where device_id=p_device_id and active=true order by id limit 30
    on conflict(device_id,source_id,daily_date) do nothing;
 end if;
 return query select * from public.daily_instances where device_id=p_device_id and daily_date=p_date order by id;
end $body$;

create or replace function public.arise_finish_daily_physical(p_user_id uuid,p_session_id uuid,p_reps integer,p_valid_ms integer,p_observations integer)
returns public.daily_instances language plpgsql security invoker set search_path=public,pg_temp as $body$
declare session public.arise_physical_sessions;daily public.daily_instances;elapsed_ms numeric;local_day date;
begin
 select * into session from public.arise_physical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found or session.daily_id is null then raise exception 'invalid_session';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||session.device_id,0));
 select * into daily from public.daily_instances where id=session.daily_id and device_id=session.device_id for update;
 if not found then raise exception 'daily_not_active';end if;
 if session.completed_at is not null then return daily;end if;
 local_day:=(now() at time zone 'Asia/Yekaterinburg')::date;
 if daily.daily_date<>local_day or (now() at time zone 'Asia/Yekaterinburg')::time>=time '23:00' then raise exception 'daily_expired';end if;
 if session.expires_at<now() then raise exception 'session_expired';end if;
 if daily.verification_mode<>'camera' or daily.physical_quest_index<>session.quest_index or daily.status not in ('active','rejected') then raise exception 'daily_not_active';end if;
 elapsed_ms:=extract(epoch from now()-session.started_at)*1000;
 if p_reps is null or p_reps not between 0 and 1000 or p_valid_ms is null or p_valid_ms not between 0 and 900000 or p_observations is null or p_observations not between 1 and 10000 then raise exception 'invalid_result';end if;
 if session.mode='hold' then
  if p_valid_ms<session.goal*1000 or elapsed_ms<p_valid_ms or p_observations<session.goal*3 then raise exception 'insufficient_result';end if;
 else
  if p_reps<session.goal or elapsed_ms<session.goal*600 or p_observations<session.goal*4 then raise exception 'insufficient_result';end if;
 end if;
 update public.arise_physical_sessions set completed_at=now(),reps=p_reps,valid_ms=p_valid_ms,observations=p_observations where id=p_session_id;
 perform public.arise_record_daily(session.device_id,daily.id,daily.daily_date,'local-camera/'||session.id::text,'Локальный счётчик','application/json',0,'accepted','Числовой результат камеры. Кадры не передавались; техника и достоверность кадров сервером не подтверждены.');
 select * into daily from public.daily_instances where id=session.daily_id;return daily;
end $body$;
revoke all on function public.arise_add_daily_v2(text,text,text,text,boolean,date,integer) from public,anon,authenticated;
revoke all on function public.arise_save_daily_source(text,bigint,text,text,boolean,integer) from public,anon,authenticated;
revoke all on function public.arise_finish_daily_physical(uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.arise_add_daily_v2(text,text,text,text,boolean,date,integer) to service_role;
grant execute on function public.arise_save_daily_source(text,bigint,text,text,boolean,integer) to service_role;
grant execute on function public.arise_finish_daily_physical(uuid,uuid,integer,integer,integer) to service_role;
commit;
