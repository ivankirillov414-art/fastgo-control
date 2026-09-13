begin;
alter table public.workshop_backend_config add column if not exists storage_mode text not null default 'google';
create table if not exists public.workshop_native_state(id integer primary key check(id=1), version bigint not null default 1, mode text not null default 'staging' check(mode in ('staging','active')), imported_at timestamptz, mirror_seen_at timestamptz, mirror_verified_at timestamptz);
insert into public.workshop_native_state(id) values(1) on conflict do nothing;
create table if not exists public.workshop_native_sheets(name text primary key, headers jsonb not null check(jsonb_typeof(headers)='array'));
create table if not exists public.workshop_native_rows(sheet text not null references public.workshop_native_sheets(name), row_no integer not null check(row_no>=2), data jsonb not null check(jsonb_typeof(data)='object'), primary key(sheet,row_no));
create table if not exists public.workshop_native_receipts(request_id uuid primary key, actor_id uuid not null, action text not null, fingerprint text not null, result jsonb not null, created_at timestamptz not null default now());
create table if not exists public.workshop_native_outbox(id bigint generated always as identity primary key, version bigint not null unique, request_id uuid not null unique references public.workshop_native_receipts(request_id), changes jsonb not null, state text not null default 'pending' check(state in ('pending','leased','synced')), lease uuid, lease_until timestamptz, attempts integer not null default 0, created_at timestamptz not null default now(), synced_at timestamptz, last_error text);
create index if not exists workshop_native_pending on public.workshop_native_outbox(id) where state<>'synced';
-- This is a private server API. Browsers and legacy bots have no grants here.
do $$ declare t text;begin foreach t in array array['workshop_native_state','workshop_native_sheets','workshop_native_rows','workshop_native_receipts','workshop_native_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end $$;
grant usage,select on sequence public.workshop_native_outbox_id_seq to service_role;
create or replace function public.workshop_native_snapshot() returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('mode',s.mode,'version',s.version,'sheets',(select coalesce(jsonb_object_agg(n.name,jsonb_build_object('headers',n.headers,'rows',(select coalesce(jsonb_agg(r.data||jsonb_build_object('__row',r.row_no) order by r.row_no),'[]') from workshop_native_rows r where r.sheet=n.name))),'{}') from workshop_native_sheets n),'sync',jsonb_build_object('pending',(select count(*) from workshop_native_outbox where state<>'synced'),'last_synced_at',(select max(synced_at) from workshop_native_outbox),'worker_seen_at',s.mirror_seen_at)) from workshop_native_state s where id=1;
$$;
create or replace function public.workshop_native_bootstrap(p_snapshot jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare st workshop_native_state; tab record; item jsonb;begin
 select * into st from workshop_native_state where id=1 for update;
 if st.mode<>'staging' or exists(select 1 from workshop_native_outbox) then raise exception 'Рабочая база уже активна';end if;
 if jsonb_typeof(p_snapshot)<>'object' or (select count(*) from jsonb_object_keys(p_snapshot))<10 then raise exception 'Неполный снимок';end if;
 delete from workshop_native_receipts;delete from workshop_native_rows;delete from workshop_native_sheets;
 for tab in select * from jsonb_each(p_snapshot) loop
  if jsonb_typeof(tab.value->'headers')<>'array' or jsonb_typeof(tab.value->'rows')<>'array' then raise exception 'Неверный снимок';end if;
  insert into workshop_native_sheets values(tab.key,tab.value->'headers');
  for item in select * from jsonb_array_elements(tab.value->'rows') loop
   insert into workshop_native_rows values(tab.key,(item->>'__row')::integer,item-'__row');
   if tab.key='Операции API' then insert into workshop_native_receipts(request_id,actor_id,action,fingerprint,result,created_at) values((item->>'request_id')::uuid,(item->>'actor_id')::uuid,item->>'action',item->>'fingerprint',(item->>'result')::jsonb,(item->>'created_at')::timestamptz);end if;
  end loop;
 end loop;
 update workshop_native_state set imported_at=now(),mirror_verified_at=null,version=version+1 where id=1;
 return jsonb_build_object('rows',(select count(*) from workshop_native_rows),'sheets',(select count(*) from workshop_native_sheets));
end $$;
create or replace function public.workshop_native_commit(p_actor uuid,p_action text,p_request_id uuid,p_fingerprint text,p_version bigint,p_changes jsonb,p_result jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare st workshop_native_state; old workshop_native_receipts; c jsonb; col text; newversion bigint; receiptrow integer; receiptvalues jsonb; changes jsonb:=p_changes;begin
 if not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('owner','admin','receiver','manager','mechanic')) then raise exception 'Нет доступа' using errcode='42501';end if;
 select * into st from workshop_native_state where id=1 for update;
 if st.mode<>'active' then raise exception 'Рабочая база ещё не переключена';end if;
 select * into old from workshop_native_receipts where request_id=p_request_id;
 if found then if old.actor_id<>p_actor or old.action<>p_action or old.fingerprint<>p_fingerprint then raise exception 'Код операции уже использован';end if;return jsonb_build_object('result',old.result,'replayed',true);end if;
 if st.version<>p_version then return jsonb_build_object('retry',true);end if;
 if p_request_id is null or p_fingerprint !~ '^[0-9a-f]{64}$' or length(p_result::text)>45000 or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>500 then raise exception 'Неверная операция';end if;
 newversion:=st.version+1;
 select coalesce(max(row_no),1)+1 into receiptrow from workshop_native_rows where sheet='Операции API';
 receiptvalues:=jsonb_build_object('request_id',p_request_id,'actor_id',p_actor,'action',p_action,'fingerprint',p_fingerprint,'result',p_result::text,'created_at',now());
 changes:=changes||jsonb_build_array(jsonb_build_object('sheet','Операции API','row',receiptrow,'values',receiptvalues));
 for c in select * from jsonb_array_elements(changes) loop
  if not exists(select 1 from workshop_native_sheets where name=c->>'sheet') or (c->>'row')::integer<2 or jsonb_typeof(c->'values')<>'object' then raise exception 'Неверная строка';end if;
  for col in select jsonb_object_keys(c->'values') loop if not exists(select 1 from workshop_native_sheets where name=c->>'sheet' and headers ? col) then raise exception 'Неизвестный столбец %',col;end if;end loop;
  insert into workshop_native_rows(sheet,row_no,data) values(c->>'sheet',(c->>'row')::integer,(select jsonb_object_agg(h,'') from workshop_native_sheets n,jsonb_array_elements_text(n.headers) h where n.name=c->>'sheet')||(c->'values')) on conflict(sheet,row_no) do update set data=workshop_native_rows.data||(c->'values');
 end loop;
 insert into workshop_native_receipts(request_id,actor_id,action,fingerprint,result) values(p_request_id,p_actor,p_action,p_fingerprint,p_result);
 insert into workshop_native_outbox(version,request_id,changes) values(newversion,p_request_id,changes);
 update workshop_native_state set version=newversion where id=1;
 return jsonb_build_object('result',p_result,'version',newversion);
end $$;
create or replace function public.workshop_native_claim() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare job workshop_native_outbox;begin
 perform 1 from workshop_native_state where id=1 for update;
 update workshop_native_state set mirror_seen_at=now() where id=1;
 select * into job from workshop_native_outbox where state<>'synced' order by id limit 1 for update;
 if not found then return jsonb_build_object('empty',true);end if;
 if job.lease_until>now() then return jsonb_build_object('busy',true);end if;
 update workshop_native_outbox set state='leased',lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'lease',job.lease,'changes',job.changes,'headers',(select jsonb_object_agg(name,headers) from workshop_native_sheets));
end $$;
create or replace function public.workshop_native_ack(p_id bigint,p_lease uuid,p_error text default null) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update workshop_native_outbox set state=case when p_error is null then 'synced' else 'pending' end,synced_at=case when p_error is null then now() else null end,lease_until=case when p_error is null then null else now()+interval '5 minutes' end,last_error=left(p_error,300) where id=p_id and lease=p_lease and state='leased';
 if not found then raise exception 'Истёк срок подтверждения';end if;return jsonb_build_object('ok',true);
end $$;
create or replace function public.workshop_native_verify(p_snapshot jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare equal boolean;begin
 select (workshop_native_snapshot()->'sheets')=p_snapshot into equal;
 update workshop_native_state set mirror_seen_at=now(),mirror_verified_at=case when equal then now() else null end where id=1;
 return jsonb_build_object('equal',equal,'mode',(select mode from workshop_native_state where id=1));
end $$;
-- No function is callable directly by browser sessions.
do $$declare f record;begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'workshop_native_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);
end loop;end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fastgo-workshop-private','fastgo-workshop-private',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
commit;
