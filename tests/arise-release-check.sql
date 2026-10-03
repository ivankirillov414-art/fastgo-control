-- Run inside an open transaction AFTER all ARISE release SQL, then ROLLBACK.
-- Uses a disposable account; does not send email or alter existing profiles.
do $check$
declare owner uuid:=gen_random_uuid();other uuid:=gen_random_uuid();device text;today date:=(now() at time zone 'Asia/Yekaterinburg')::date;daily public.daily_instances;source public.daily_sources;session_id uuid:=gen_random_uuid();project jsonb;again jsonb;earned integer;
begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous)values(owner,'arise-release-test@example.invalid',now(),false);
 device:=public.arise_account_device(owner);
 daily:=public.arise_add_daily_v2(device,'Проверяем тренировку','Камера считает пять отжиманий','physical',true,today,52);
 if daily.xp<>25 or daily.verification_mode<>'camera' or daily.physical_quest_index<>52 then raise exception 'physical daily settings';end if;
 insert into public.arise_physical_sessions(id,user_id,device_id,quest_index,goal,mode,started_at,expires_at,daily_id)
 values(session_id,owner,device,52,5,'reps',now()-interval '1 minute',now()+interval '14 minutes',daily.id);
 daily:=public.arise_finish_daily_physical(owner,session_id,5,0,20);
 if daily.status<>'completed' or not daily.xp_awarded then raise exception 'daily not rewarded';end if;
 daily:=public.arise_finish_daily_physical(owner,session_id,5,0,20);
 if (select count(*) from public.daily_evidence where daily_instance_id=daily.id)<>1 then raise exception 'duplicate camera reward';end if;
 if exists(select 1 from public.quest_evidence where device_id=device) then raise exception 'daily also completed exam';end if;
 earned:=(public.sync_rpg_progress_from_evidence(device)).xp;if earned<>25 then raise exception 'incorrect daily xp';end if;
 source:=public.arise_save_daily_source(device,daily.source_id,'Новый заголовок','Новые условия',false,null);
 perform public.arise_daily_list(device,today+1,false);
 if exists(select 1 from public.daily_instances where device_id=device and daily_date=today+1) then raise exception 'paused template repeated';end if;
 if (select title from public.daily_instances where id=daily.id)<>'Проверяем тренировку' then raise exception 'changed issued daily';end if;
 project:=public.arise_save_project(owner,null,'create','Робот','Проверяемый результат','active',array['robotics-01'],null);
 again:=public.arise_save_project(other,(project->>'id')::uuid,'update','Чужой','Данные','active','{}',(project->>'updated_at')::timestamptz);
 if again->>'error'<>'project_not_found' then raise exception 'foreign owner allowed';end if;
 project:=public.arise_save_project(owner,(project->>'id')::uuid,'archive','Робот','Проверяемый результат',null,null,(project->>'updated_at')::timestamptz);
 if project->>'status'<>'archived' or project->'skills'<>jsonb_build_array('robotics-01') then raise exception 'archive lost skills';end if;
 project:=public.arise_save_project(owner,(project->>'id')::uuid,'restore','Робот','Проверяемый результат',null,null,(project->>'updated_at')::timestamptz);
 if project->>'status'<>'active' then raise exception 'restore status';end if;
 if has_function_privilege('anon','public.arise_finish_daily_physical(uuid,uuid,integer,integer,integer)','execute') or has_function_privilege('authenticated','public.arise_save_project(uuid,uuid,text,text,text,text,text[],timestamptz)','execute') then raise exception 'public RPC permission';end if;
end $check$;
select 'SQL lifecycle checks passed' as verification;
