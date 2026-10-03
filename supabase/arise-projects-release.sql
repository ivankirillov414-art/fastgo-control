-- Apply after arise-tree-release.sql. Project changes use one transaction.
begin;
alter table public.arise_projects add column if not exists archived_from_status text
 check(archived_from_status is null or archived_from_status in ('planned','active','completed'));

create or replace function public.arise_save_project(
 p_user_id uuid,p_id uuid,p_action text,p_title text,p_description text,p_status text,p_skills text[],p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $body$
declare project public.arise_projects;next_status text;skills text[];
begin
 if p_user_id is null or p_action is null or p_action not in ('create','update','archive','restore') then
  raise exception 'invalid_project';
 end if;
 if p_action in ('create','update') then
  if p_title is null or length(trim(p_title)) not between 2 and 160 or p_description is null or length(p_description)>2000
   or p_status is null or p_status not in ('planned','active','completed') or p_skills is null or cardinality(p_skills)>12
   or exists(select 1 from unnest(p_skills)s where s is null or length(s) not between 1 and 100) then
   raise exception 'invalid_project';
  end if;
  select coalesce(array_agg(distinct s),'{}'::text[]) into skills from unnest(p_skills)s;
 end if;
 if p_action='create' then
  if p_id is not null then raise exception 'invalid_project';end if;
  insert into public.arise_projects(user_id,title,description,status)
   values(p_user_id,trim(p_title),p_description,p_status) returning * into project;
 else
  select * into project from public.arise_projects where id=p_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('error','project_not_found');end if;
  if p_expected_updated_at is null or project.updated_at<>p_expected_updated_at then
   return jsonb_build_object('error','project_changed');
  end if;
  if p_action='update' then
   if project.status='archived' then return jsonb_build_object('error','project_archived');end if;
   update public.arise_projects set title=trim(p_title),description=p_description,status=p_status,
    updated_at=greatest(clock_timestamp(),project.updated_at+interval '1 microsecond')
    where id=project.id and user_id=p_user_id returning * into project;
  elsif p_action='archive' then
   if project.status<>'archived' then
    update public.arise_projects set archived_from_status=project.status,status='archived',
     updated_at=greatest(clock_timestamp(),project.updated_at+interval '1 microsecond')
     where id=project.id and user_id=p_user_id returning * into project;
   end if;
  else
   if project.status='archived' then
    next_status:=coalesce(project.archived_from_status,'active');
    update public.arise_projects set status=next_status,archived_from_status=null,
     updated_at=greatest(clock_timestamp(),project.updated_at+interval '1 microsecond')
     where id=project.id and user_id=p_user_id returning * into project;
   end if;
  end if;
 end if;
 if p_action in ('create','update') then
  -- Replace links only: earned XP, proof records and projects remain intact.
  delete from public.arise_project_skills where project_id=project.id and not(skill_id=any(skills));
  insert into public.arise_project_skills(project_id,skill_id)
   select project.id,s from unnest(skills)s on conflict(project_id,skill_id) do nothing;
 end if;
 select coalesce(array_agg(skill_id order by skill_id),'{}'::text[]) into skills
  from public.arise_project_skills where project_id=project.id;
 return (to_jsonb(project)-'user_id'-'archived_from_status')||jsonb_build_object('skills',skills);
end $body$;
revoke all on function public.arise_save_project(uuid,uuid,text,text,text,text,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.arise_save_project(uuid,uuid,text,text,text,text,text[],timestamptz) to service_role;
commit;
