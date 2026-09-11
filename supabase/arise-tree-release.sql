-- ARISE development tree. Apply after arise-release.sql and arise-auth-release.sql.
begin;
create table if not exists public.arise_skill_progress(
 user_id uuid not null references auth.users(id),skill_id text not null,
 level integer not null default 0 check(level between 0 and 5),xp integer not null default 0 check(xp>=0),
 active boolean not null default false,updated_at timestamptz not null default now(),
 primary key(user_id,skill_id)
);
create table if not exists public.arise_projects(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 2 and 160),description text not null default '' check(length(description)<=2000),
 status text not null default 'active' check(status in ('planned','active','completed','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.arise_project_skills(
 project_id uuid not null references public.arise_projects(id) on delete cascade,
 skill_id text not null,created_at timestamptz not null default now(),primary key(project_id,skill_id)
);
create table if not exists public.arise_skill_evidence(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),skill_id text not null,
 target_level integer not null check(target_level between 1 and 5),practical_task text not null,
 project_id uuid references public.arise_projects(id) on delete set null,evidence_text text not null check(length(trim(evidence_text)) between 20 and 2000),
 evidence_url text check(evidence_url is null or evidence_url~'^https://'),status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 review_note text,created_at timestamptz not null default now(),reviewed_at timestamptz
);
create unique index if not exists arise_one_pending_skill_level on public.arise_skill_evidence(user_id,skill_id,target_level) where status='pending';
create index if not exists arise_skill_evidence_owner_created on public.arise_skill_evidence(user_id,created_at desc);
create table if not exists public.arise_boss_progress(
 user_id uuid not null references auth.users(id),boss_id text not null,title text not null,xp integer not null check(xp>=0),
 status text not null default 'planned' check(status in ('planned','active','pending','accepted','rejected')),
 project_id uuid references public.arise_projects(id) on delete set null,skill_ids text[] not null default '{}',evidence_text text,review_note text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(user_id,boss_id)
);
alter table public.arise_boss_progress add column if not exists skill_ids text[] not null default '{}';
create table if not exists public.arise_progress_log(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),
 event_type text not null,reference_id text not null,xp integer not null default 0,payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists arise_progress_log_owner_created on public.arise_progress_log(user_id,created_at desc);
create index if not exists arise_projects_owner_updated on public.arise_projects(user_id,updated_at desc);

alter table public.arise_skill_progress enable row level security;
alter table public.arise_projects enable row level security;
alter table public.arise_project_skills enable row level security;
alter table public.arise_skill_evidence enable row level security;
alter table public.arise_boss_progress enable row level security;
alter table public.arise_progress_log enable row level security;
revoke all on public.arise_skill_progress,public.arise_projects,public.arise_project_skills,public.arise_skill_evidence,public.arise_boss_progress,public.arise_progress_log from anon,authenticated;
grant all on public.arise_skill_progress,public.arise_projects,public.arise_project_skills,public.arise_skill_evidence,public.arise_boss_progress,public.arise_progress_log to service_role;
grant usage,select on sequence public.arise_progress_log_id_seq to service_role;

alter table public.rpg_progress add column if not exists skill_xp integer not null default 0;
alter table public.rpg_progress add column if not exists boss_xp integer not null default 0;
create or replace function public.sync_rpg_progress_from_evidence(p_device_id text)
returns public.rpg_progress language plpgsql security invoker set search_path=public,pg_temp as $body$
declare q integer[];quest_xp integer;dxp integer;sxp integer;bxp integer;owner uuid;rewards integer[]:=array[40,50,60,80,90,180,100,120,130,140,150,160,180,350,220,230,250,260,280,300,550,320,350,280,350,380,400,420,450,750,300,400,550,650,500,900,2000,30,40,50,60,60,60,80,90,90,100,160,100,120,140,250,25,30,35,40,45,50,25,30,35,40,45,50,25,30,35,40,45,50,25,30,35,40,45,50];result public.rpg_progress;
begin
 if p_device_id!~'^[a-zA-Z0-9_-]{16,80}$' then raise exception 'invalid_device';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||p_device_id,0));
 select user_id into owner from public.arise_accounts where device_id=p_device_id;
 select coalesce(array_agg(quest_index order by quest_index),'{}'::integer[]) into q from public.quest_evidence where device_id=p_device_id and status='accepted';
 select coalesce(sum(rewards[i+1]),0) into quest_xp from unnest(q)i where i>=0 and i<array_length(rewards,1);
 select coalesce(sum(xp),0) into dxp from public.daily_instances where device_id=p_device_id and status='completed' and xp_awarded=true;
 select coalesce(sum(xp),0) into sxp from public.arise_skill_progress where user_id=owner;
 select coalesce(sum(xp),0) into bxp from public.arise_boss_progress where user_id=owner and status='accepted';
 insert into public.rpg_progress(device_id,xp,daily_xp,skill_xp,boss_xp,completed_quests,updated_at)
 values(p_device_id,quest_xp+dxp+sxp+bxp,dxp,sxp,bxp,q,now()) on conflict(device_id) do update set
 xp=excluded.xp,daily_xp=excluded.daily_xp,skill_xp=excluded.skill_xp,boss_xp=excluded.boss_xp,completed_quests=excluded.completed_quests,updated_at=now()
 returning * into result;return result;
end $body$;

create or replace function public.arise_review_skill(p_evidence_id uuid,p_accept boolean,p_note text)
returns public.arise_skill_evidence language plpgsql security invoker set search_path=public,pg_temp as $body$
declare e public.arise_skill_evidence;current_level integer;reward integer;result public.arise_skill_evidence;
begin
 select * into e from public.arise_skill_evidence where id=p_evidence_id for update;
 if not found or e.status<>'pending' then raise exception 'evidence_not_pending';end if;
 select coalesce(level,0) into current_level from public.arise_skill_progress where user_id=e.user_id and skill_id=e.skill_id;
 if p_accept and e.target_level<>current_level+1 then raise exception 'level_sequence_changed';end if;
 update public.arise_skill_evidence set status=case when p_accept then 'accepted' else 'rejected' end,review_note=left(p_note,500),reviewed_at=now() where id=e.id returning * into result;
 if p_accept then
  reward:=(array[20,35,60,100,180])[e.target_level];
  insert into public.arise_skill_progress(user_id,skill_id,level,xp,active)values(e.user_id,e.skill_id,e.target_level,reward,e.target_level<5)
  on conflict(user_id,skill_id)do update set level=excluded.level,xp=arise_skill_progress.xp+excluded.xp,active=excluded.active,updated_at=now();
  insert into public.arise_progress_log(user_id,event_type,reference_id,xp,payload)values(e.user_id,'skill_level',e.skill_id,reward,jsonb_build_object('level',e.target_level));
 end if;return result;
end $body$;

create or replace function public.arise_review_boss(p_user_id uuid,p_boss_id text,p_accept boolean,p_note text)
returns public.arise_boss_progress language plpgsql security invoker set search_path=public,pg_temp as $body$
declare b public.arise_boss_progress;result public.arise_boss_progress;skill text;reward integer;
begin
 select * into b from public.arise_boss_progress where user_id=p_user_id and boss_id=p_boss_id for update;
 if not found or b.status<>'pending' then raise exception 'boss_not_pending';end if;
 update public.arise_boss_progress set status=case when p_accept then 'accepted' else 'rejected' end,review_note=left(p_note,500),updated_at=now() where user_id=p_user_id and boss_id=p_boss_id returning * into result;
 if p_accept then
  reward:=case when cardinality(b.skill_ids)>0 then greatest(1,floor(b.xp*0.25/cardinality(b.skill_ids))) else 0 end;
  foreach skill in array b.skill_ids loop
   insert into public.arise_skill_progress(user_id,skill_id,xp)values(p_user_id,skill,reward)
   on conflict(user_id,skill_id)do update set xp=arise_skill_progress.xp+excluded.xp,updated_at=now();
  end loop;
  insert into public.arise_progress_log(user_id,event_type,reference_id,xp,payload)values(p_user_id,'boss_quest',p_boss_id,b.xp,jsonb_build_object('skill_ids',b.skill_ids,'skill_bonus_each',reward));
 end if;
 return result;
end $body$;

revoke all on function public.arise_review_skill(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.arise_review_boss(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.arise_review_skill(uuid,boolean,text) to service_role;
grant execute on function public.arise_review_boss(uuid,text,boolean,text) to service_role;
commit;
