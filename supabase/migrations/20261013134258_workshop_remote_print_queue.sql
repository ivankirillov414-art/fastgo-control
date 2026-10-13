create table public.workshop_print_station (
 id smallint primary key check(id=1), enabled boolean not null default false,
 station_id uuid, owner_id uuid, label text not null default 'Ноутбук мастерской',
 last_seen timestamptz, updated_at timestamptz not null default now()
);
insert into public.workshop_print_station(id) values(1);
create table public.workshop_print_jobs (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 kind text not null check(kind in ('repair','storage')), record_id uuid not null,
 created_by uuid not null, created_at timestamptz not null default now(),
 status text not null default 'queued' check(status in ('queued','claimed','dispatched','submitted','failed')),
 claimed_by uuid, claim_token uuid, lease_until timestamptz, dispatched_at timestamptz,
 submitted_at timestamptz, error text
);
create index workshop_print_jobs_pending on public.workshop_print_jobs(created_at) where status in ('queued','claimed');
alter table public.workshop_print_station enable row level security;
alter table public.workshop_print_jobs enable row level security;
revoke all on public.workshop_print_station,public.workshop_print_jobs from public,anon,authenticated;
grant all on public.workshop_print_station,public.workshop_print_jobs to service_role;
create function public.workshop_print_queue(
 p_action text,p_actor uuid,p_station uuid default null,p_kind text default null,
 p_record uuid default null,p_request uuid default null,p_job uuid default null,p_error text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare st public.workshop_print_station%rowtype; j public.workshop_print_jobs%rowtype;
begin
 select * into st from public.workshop_print_station where id=1 for update;
 if p_action='status' then
  return jsonb_build_object('enabled',st.enabled,'station_id',st.station_id,'owner_id',st.owner_id,'label',st.label,'last_seen',st.last_seen,
   'jobs',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,kind,record_id,status,created_at,error from public.workshop_print_jobs order by created_at desc limit 20) q),'[]'::jsonb));
 elsif p_action='activate' then
  if p_station is null then raise exception 'Missing station'; end if;
  update public.workshop_print_station set enabled=true,station_id=p_station,owner_id=p_actor,last_seen=now(),updated_at=now() where id=1;
  return jsonb_build_object('enabled',true);
 elsif p_action='deactivate' then
  update public.workshop_print_station set enabled=false,updated_at=now() where id=1;
  return jsonb_build_object('enabled',false);
 elsif p_action='enqueue' then
  if not st.enabled then return jsonb_build_object('enabled',false); end if;
  if p_record is null or p_kind not in ('repair','storage') or p_request is null then raise exception 'Invalid print job'; end if;
  insert into public.workshop_print_jobs(dedupe_key,kind,record_id,created_by)
   values(p_kind||':'||p_record::text||':'||p_request::text,p_kind,p_record,p_actor)
   on conflict(dedupe_key) do nothing;
  select * into j from public.workshop_print_jobs where dedupe_key=p_kind||':'||p_record::text||':'||p_request::text;
  return jsonb_build_object('enabled',true,'job',to_jsonb(j));
 elsif p_action='retry' then
  update public.workshop_print_jobs set status='queued',claimed_by=null,claim_token=null,lease_until=null,error=null,dispatched_at=null,submitted_at=null
   where id=p_job and status in ('failed','dispatched') returning * into j;
  if j.id is null then raise exception 'Job cannot be retried'; end if;
  return jsonb_build_object('job',to_jsonb(j));
 end if;
 if not st.enabled or st.station_id is distinct from p_station or st.owner_id is distinct from p_actor then
  raise exception using errcode='42501',message='This device is not the active print station';
 end if;
 update public.workshop_print_station set last_seen=now() where id=1;
 if p_action='claim' then
  update public.workshop_print_jobs set status='queued',claimed_by=null,claim_token=null,lease_until=null
   where status='claimed' and lease_until<now();
  if exists(select 1 from public.workshop_print_jobs where status='claimed') then return jsonb_build_object('job',null); end if;
  select * into j from public.workshop_print_jobs where status='queued' order by created_at,id limit 1 for update skip locked;
  if j.id is null then return jsonb_build_object('job',null); end if;
  update public.workshop_print_jobs set status='claimed',claimed_by=p_actor,claim_token=p_request,lease_until=now()+interval '3 minutes',error=null where id=j.id returning * into j;
 elsif p_action='dispatch' then
  update public.workshop_print_jobs set status='dispatched',dispatched_at=now()
   where id=p_job and status='claimed' and claimed_by=p_actor and claim_token=p_request and lease_until>now() returning * into j;
 elsif p_action='complete' then
  update public.workshop_print_jobs set status='submitted',submitted_at=now()
   where id=p_job and status='dispatched' and claimed_by=p_actor and claim_token=p_request returning * into j;
 elsif p_action='fail' then
  update public.workshop_print_jobs set status='failed',error=left(coalesce(p_error,'Не удалось подготовить документ'),500)
   where id=p_job and status='claimed' and claimed_by=p_actor and claim_token=p_request returning * into j;
 else raise exception 'Unknown print action';
 end if;
 if j.id is null then raise exception using errcode='40001',message='Print job changed; reload queue'; end if;
 return jsonb_build_object('job',to_jsonb(j));
end $$;
revoke all on function public.workshop_print_queue(text,uuid,uuid,text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.workshop_print_queue(text,uuid,uuid,text,uuid,uuid,uuid,text) to service_role;