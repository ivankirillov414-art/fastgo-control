begin;
create table if not exists public.arise_reviewers(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
create table if not exists public.arise_review_audit(id bigint generated always as identity primary key,reviewer_id uuid not null references auth.users(id),kind text not null,reference_id text not null,decision text not null,note text not null,created_at timestamptz not null default now());
alter table public.arise_reviewers enable row level security;
alter table public.arise_review_audit enable row level security;
revoke all on public.arise_reviewers,public.arise_review_audit from anon,authenticated;
grant all on public.arise_reviewers,public.arise_review_audit to service_role;
grant usage,select on sequence public.arise_review_audit_id_seq to service_role;
create or replace function public.arise_review_daily(p_evidence_id bigint,p_accept boolean,p_note text)
returns public.daily_evidence language plpgsql security invoker set search_path=public,pg_temp as $body$
declare evidence public.daily_evidence;daily public.daily_instances;
begin
 select * into evidence from public.daily_evidence where id=p_evidence_id for update;
 if not found or evidence.status<>'pending' then raise exception 'evidence_not_pending';end if;
 perform pg_advisory_xact_lock(hashtextextended('arise:'||evidence.device_id,0));
 select * into daily from public.daily_instances where id=evidence.daily_instance_id and device_id=evidence.device_id for update;
 if not found or daily.status='completed' then raise exception 'evidence_not_pending';end if;
 update public.daily_evidence set status=case when p_accept then 'accepted' else 'rejected' end,review_note=left(p_note,500),reviewed_at=now() where id=p_evidence_id returning * into evidence;
 update public.daily_instances set status=case when p_accept then 'completed' else 'rejected' end,xp_awarded=p_accept,completed_at=case when p_accept then now() end where id=daily.id;
 return evidence;
end $body$;
revoke all on function public.arise_review_daily(bigint,boolean,text) from public,anon,authenticated;
grant execute on function public.arise_review_daily(bigint,boolean,text) to service_role;
commit;
