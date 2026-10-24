-- Private, independent recovery archives. The archive itself is encrypted by
-- the Edge worker; browsers cannot read the tables, bucket or encryption key.
begin;
create table if not exists public.workshop_backups (
 id uuid primary key, source_version bigint not null, created_at timestamptz not null default now(),
 object_path text not null unique, sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 bytes bigint not null check(bytes>0), key_id uuid not null,
 manifest jsonb not null check(jsonb_typeof(manifest)='object')
);
create index if not exists workshop_backups_created on public.workshop_backups(created_at desc);
create table if not exists public.workshop_backup_media (
 id text primary key check(id ~ '^[0-9a-f]{64}$'), bucket text not null, source_path text not null,
 source_stamp text not null, object_path text not null unique, sha256 text not null,
 plain_sha256 text not null, bytes bigint not null check(bytes>0), key_id uuid not null,
 created_at timestamptz not null default now()
);
create table if not exists public.workshop_backup_devices (
 device_id uuid primary key, token_hash text not null, public_key text, public_key_sha256 text,
 registered_by uuid not null references auth.users(id), app text not null check(app in ('desktop','warehouse')),
 registered_at timestamptz not null default now(), last_seen timestamptz,
 snapshot_id uuid references public.workshop_backups(id), source_version bigint,
 media_expected integer not null default 0, media_present integer not null default 0,
 verified_at timestamptz, last_error text not null default '', host text not null default ''
);
create table if not exists public.workshop_backup_control (
 id integer primary key check(id=1), key_id uuid not null default gen_random_uuid(),
 lease_until timestamptz, last_started_at timestamptz, last_completed_at timestamptz,
 last_error text not null default '', server_url text
);
insert into public.workshop_backup_control(id) values(1) on conflict do nothing;
do $$ declare t text;begin foreach t in array array['workshop_backups','workshop_backup_media','workshop_backup_devices','workshop_backup_control'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
end loop;end $$;
insert into storage.buckets(id,name,public,file_size_limit) values('fastgo-backups','fastgo-backups',false,33554432) on conflict(id) do update set public=false;

-- A stable SQL function sees one MVCC snapshot across business data, settings,
-- account records and file metadata. Restricted to the server service role.
create or replace function public.workshop_backup_export() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare t record; rows jsonb; tables jsonb:='{}'; definitions jsonb:='{}'; media jsonb; accounts uuid[];
begin
 select array_agg(profile_id) into accounts from public.workshop_members;
 for t in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'workshop\_%' escape '\'
  and c.relname not like 'workshop\_backup%' escape '\' and c.relname not in ('workshop_device_status','workshop_app_versions') order by c.relname loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from public.%I x',t.relname) into rows;
  tables:=tables||jsonb_build_object('public.'||t.relname,rows);
  definitions:=definitions||jsonb_build_object(t.relname,jsonb_build_object(
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',conname,'type',contype,'sql',pg_get_constraintdef(oid,true))),'[]') from pg_constraint where conrelid=t.oid),
   'indexes',(select coalesce(jsonb_agg(pg_get_indexdef(i.indexrelid)),'[]') from pg_index i where i.indrelid=t.oid and not exists(select 1 from pg_constraint where conindid=i.indexrelid)),
   'triggers',(select coalesce(jsonb_agg(pg_get_triggerdef(oid,true)),'[]') from pg_trigger where tgrelid=t.oid and not tgisinternal),
   'rls',(select relrowsecurity from pg_class where oid=t.oid)));
 end loop;
 for t in select table_name from information_schema.tables where table_schema='auth' and table_name in ('users','identities','sessions','refresh_tokens','mfa_factors','mfa_challenges','mfa_amr_claims') order by table_name loop
  if t.table_name='users' then execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from auth.users x where id=any($1)' into rows using accounts;
  elsif t.table_name in ('identities','sessions','mfa_factors') then execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from auth.%I x where user_id=any($1)',t.table_name) into rows using accounts;
  elsif t.table_name='refresh_tokens' then execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from auth.refresh_tokens x where user_id=any(select unnest($1)::text)' into rows using accounts;
  elsif t.table_name='mfa_challenges' then execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from auth.mfa_challenges x where factor_id in (select id from auth.mfa_factors where user_id=any($1))' into rows using accounts;
  else execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]'') from auth.mfa_amr_claims x where session_id in (select id from auth.sessions where user_id=any($1))' into rows using accounts;end if;
  tables:=tables||jsonb_build_object('auth.'||t.table_name,rows);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name,'stamp',updated_at::text||':'||coalesce(metadata->>'eTag',''),'bytes',coalesce((metadata->>'size')::bigint,0)) order by name),'[]') into media from storage.objects where bucket_id='fastgo-workshop-private';
 return jsonb_build_object('format',1,'source_version',(select version from public.workshop_native_state where id=1),'native',public.workshop_native_snapshot(),'tables',tables,'schema',definitions,'media',media,
  'functions',(select coalesce(jsonb_agg(pg_get_functiondef(p.oid)),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and (p.proname like '%workshop%' or p.proname like 'warehouse_%') and p.proname not like 'workshop_backup%'),
  'extensions',(select jsonb_agg(extname) from pg_extension),
  'secrets',(select coalesce(jsonb_object_agg(name,decrypted_secret),'{}') from vault.decrypted_secrets where name='fastgo_avito_credentials'));
end $$;
revoke all on function public.workshop_backup_export() from public,anon,authenticated;
grant execute on function public.workshop_backup_export() to service_role;

create or replace function public.workshop_backup_keys() returns jsonb
language plpgsql security invoker set search_path=public,vault,pg_temp as $$
declare v_key text;v_job text;v_id uuid;begin
 if current_user not in ('service_role','postgres') then raise exception 'Forbidden';end if;
 perform id from public.workshop_backup_control where id=1 for update;
 select decrypted_secret into v_key from vault.decrypted_secrets where name='fastgo_backup_aes_key';
 if v_key is null then v_key:=encode(extensions.gen_random_bytes(32),'base64');perform vault.create_secret(v_key,'fastgo_backup_aes_key','FastGo encrypted recovery archives');end if;
 select decrypted_secret into v_job from vault.decrypted_secrets where name='fastgo_backup_job_token';
 if v_job is null then v_job:=encode(extensions.gen_random_bytes(32),'hex');perform vault.create_secret(v_job,'fastgo_backup_job_token','FastGo private scheduled backup');end if;
 return jsonb_build_object('key',v_key,'job_token',v_job,'key_id',(select key_id from public.workshop_backup_control where id=1));
end $$;
revoke all on function public.workshop_backup_keys() from public,anon,authenticated;
grant execute on function public.workshop_backup_keys() to service_role;

create or replace function public.workshop_backup_schedule(p_url text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare job_id bigint;begin
 if p_url !~ '^https://[a-z0-9.-]+(:[0-9]+)?/functions/v1/fastgo-backups$' then raise exception 'Invalid backup endpoint';end if;
 perform public.workshop_backup_keys();
 update public.workshop_backup_control set server_url=p_url where id=1;
 select jobid into job_id from cron.job where jobname='fastgo-recovery-archives';if job_id is not null then perform cron.unschedule(job_id);end if;
 perform cron.schedule('fastgo-recovery-archives','*/5 * * * *',$job$
  select net.http_post(url:=(select server_url from public.workshop_backup_control where id=1),
   headers:=jsonb_build_object('Content-Type','application/json','X-FastGo-Backup-Job',(select decrypted_secret from vault.decrypted_secrets where name='fastgo_backup_job_token')),
   body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=120000);
 $job$);
 return jsonb_build_object('scheduled',true,'interval_minutes',5);
end $$;
revoke all on function public.workshop_backup_schedule(text) from public,anon,authenticated;
grant execute on function public.workshop_backup_schedule(text) to service_role;
commit;
