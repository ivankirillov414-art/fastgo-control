-- Completion acts are durable payment side effects, independent of open cards.
-- Legacy workers remain intake-only until they advertise completion support.
alter table public.workshop_print_jobs add column document_type text not null default 'master'
 check(document_type in ('master','completion') and (document_type<>'completion' or kind='repair'));
alter table public.workshop_print_station
 add column document_types text[] not null default array['master'],
 add column client_version text, add column host text, add column printer_name text;

create function public.workshop_repair_completion_request(p_record uuid) returns uuid
language plpgsql stable security invoker set search_path='' as $$
declare repair jsonb; entry record; detail jsonb; state jsonb:='{}'; paid numeric; total numeric;
begin
 select data into repair from public.workshop_native_rows where sheet='Ремонты' and data->>'repair_id'=p_record::text;
 if repair is null or repair->>'Статус' not in ('issued','Выдан') then return null; end if;
 begin
  paid:=(repair->>'Оплачено')::numeric; total:=(repair->>'Итого')::numeric;
 exception when invalid_text_representation then return null; end;
 if paid is null or total is null or paid<=0 or total<0 or round(paid,2)<round(total,2) then return null; end if;
 -- Match the native engine's ordered merge, including legacy malformed events.
 for entry in select data from public.workshop_native_rows where sheet='События'
  and data->>'Тип'='repair' and data->>'record_id'=p_record::text and data->>'Действие'='repair_steps' order by row_no loop
  begin detail:=(entry.data->>'Детали')::jsonb;
  exception when invalid_text_representation then continue; end;
  if jsonb_typeof(detail)='object' then state:=state||detail; end if;
 end loop;
 if state->'payment_qr' is distinct from 'true'::jsonb then return null; end if;
 begin return (state->>'completion_request_id')::uuid;
 exception when invalid_text_representation then return null; end;
end $$;
revoke all on function public.workshop_repair_completion_request(uuid) from public,anon,authenticated;
grant execute on function public.workshop_repair_completion_request(uuid) to service_role;

drop function public.workshop_print_queue(text,uuid,uuid,text,uuid,uuid,uuid,text);
create function public.workshop_print_queue(
 p_action text,p_actor uuid,p_station uuid default null,p_kind text default null,
 p_record uuid default null,p_request uuid default null,p_job uuid default null,p_error text default null,
 p_document_type text default 'master',p_document_types text[] default array['master'],
 p_client_version text default null,p_host text default null,p_printer_name text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare st public.workshop_print_station%rowtype; j public.workshop_print_jobs%rowtype;
 purpose text:=coalesce(p_document_type,'master'); request uuid:=p_request; completion_request uuid; dedupe text;
begin
 select * into st from public.workshop_print_station where id=1 for update;
 if p_action='status' then
  return jsonb_build_object('enabled',st.enabled,'station_id',st.station_id,'owner_id',st.owner_id,'label',st.label,'last_seen',st.last_seen,'document_types',st.document_types,'client_version',st.client_version,'host',st.host,'printer_name',st.printer_name,
   'jobs',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,kind,record_id,document_type,status,created_at,error from public.workshop_print_jobs order by created_at desc limit 20) q),'[]'::jsonb));
 elsif p_action='activate' then
  if p_station is null then raise exception 'Missing station'; end if;
  update public.workshop_print_station set enabled=true,station_id=p_station,owner_id=p_actor,last_seen=now(),updated_at=now(),document_types=array['master'],client_version=null,host=null,printer_name=null where id=1;
  return jsonb_build_object('enabled',true);
 elsif p_action='deactivate' then
  update public.workshop_print_station set enabled=false,updated_at=now() where id=1;
  return jsonb_build_object('enabled',false);
 elsif p_action='enqueue' then
  if not st.enabled then return jsonb_build_object('enabled',false); end if;
  if p_record is null or p_kind not in ('repair','storage') or p_request is null then raise exception 'Invalid print job'; end if;
  if purpose not in ('master','completion') or (purpose='completion' and p_kind<>'repair') then raise exception 'Invalid document type'; end if;
  if p_kind='repair' then
   completion_request:=public.workshop_repair_completion_request(p_record);
   -- Old clients enqueue with the completion request when reopening the card.
   -- Resolve that request to the same act already queued by payment commit.
   if completion_request=p_request then purpose:='completion'; end if;
  end if;
  if purpose='completion' then
   if completion_request is null then raise exception 'Repair is not completed and paid'; end if;
   request:=completion_request;
  end if;
  -- Keep legacy completion keys: a previously submitted act must not print again
  -- merely because its card is opened after this update.
  dedupe:=p_kind||':'||p_record::text||':'||request::text;
  insert into public.workshop_print_jobs(dedupe_key,kind,record_id,created_by,document_type)
   values(dedupe,p_kind,p_record,p_actor,purpose) on conflict(dedupe_key) do nothing;
  select * into j from public.workshop_print_jobs where dedupe_key=dedupe;
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
 if p_action='claim' then
  if not coalesce(p_document_types,array['master']) <@ array['master','completion'] then raise exception 'Invalid print capabilities'; end if;
  update public.workshop_print_station set last_seen=now(),document_types=coalesce(p_document_types,array['master']),
   client_version=left(p_client_version,40),host=left(p_host,80),printer_name=left(p_printer_name,200) where id=1;
 else
  update public.workshop_print_station set last_seen=now() where id=1;
 end if;
 if p_action='claim' then
  update public.workshop_print_jobs set status='queued',claimed_by=null,claim_token=null,lease_until=null
   where status='claimed' and lease_until<now();
  if exists(select 1 from public.workshop_print_jobs where status='claimed') then return jsonb_build_object('job',null); end if;
  -- An edited act may require another payment. Never print its obsolete queued
  -- revision, including when the service laptop was offline during correction.
  update public.workshop_print_jobs set status='failed',error='Акт изменён. Дождитесь оплаты текущей версии ремонта.'
   where status='queued' and document_type='completion' and dedupe_key is distinct from
    ('repair:'||record_id::text||':'||public.workshop_repair_completion_request(record_id)::text);
  select * into j from public.workshop_print_jobs where status='queued' and document_type=any(coalesce(p_document_types,array['master'])) order by created_at,id limit 1 for update skip locked;
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
 return jsonb_build_object('job',to_jsonb(j)||case when j.document_type='completion' then jsonb_build_object('completion_request_id',split_part(j.dedupe_key,':',3)) else '{}'::jsonb end);
end $$;
revoke all on function public.workshop_print_queue(text,uuid,uuid,text,uuid,uuid,uuid,text,text,text[],text,text,text) from public,anon,authenticated;
grant execute on function public.workshop_print_queue(text,uuid,uuid,text,uuid,uuid,uuid,text,text,text[],text,text,text) to service_role;
-- The private receipt is inserted after all ledger, repair and event changes in
-- workshop_native_commit. Any rollback also removes the act; a replay inserts
-- no new receipt. Do not enqueue historical receipts during migration.
create function public.workshop_print_paid_repair() returns trigger
language plpgsql security invoker set search_path='' as $$
declare repair_id uuid; request uuid;
begin
 begin repair_id:=(new.result->>'repair_id')::uuid;
 exception when invalid_text_representation then return new; end;
 if repair_id is null or not exists(select 1 from public.workshop_native_rows where sheet='Оплаты'
  and data->>'request_id'=new.request_id::text and data->>'record_id'=repair_id::text and data->>'Тип'='repair') then return new; end if;
 request:=public.workshop_repair_completion_request(repair_id);
 if request is not null then
  perform public.workshop_print_queue(p_action=>'enqueue',p_actor=>new.actor_id,p_kind=>'repair',p_record=>repair_id,p_request=>request,p_document_type=>'completion');
 end if;
 return new;
end $$;
revoke all on function public.workshop_print_paid_repair() from public,anon,authenticated;
grant execute on function public.workshop_print_paid_repair() to service_role;
create trigger workshop_print_paid_repair after insert on public.workshop_native_receipts for each row
 when (new.action='warehouse_repair_payment' and new.result->'repair_completed'='true'::jsonb)
 execute function public.workshop_print_paid_repair();
notify pgrst, 'reload schema';
