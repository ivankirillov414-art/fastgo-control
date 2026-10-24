-- Private integration state. Client applications use the authenticated Edge API.
create table if not exists public.workshop_avito_connection (
 id smallint primary key default 1 check (id=1),
 account_id text check (account_id ~ '^[0-9]{1,20}$'),label text not null default '',
 enabled boolean not null default false,connected_by uuid references public.workshop_members(profile_id),
 connected_at timestamptz,last_synced_at timestamptz,next_poll_at timestamptz not null default now(),
 popup_station_id uuid references public.workshop_warehouse_devices(id),last_error text not null default '',
 chat_cursors jsonb not null default '{}'::jsonb check(jsonb_typeof(chat_cursors)='object')
);
insert into public.workshop_avito_connection(id,popup_station_id)
select 1,station_id from public.workshop_terminal_stations where slot=1 on conflict(id) do nothing;
create table if not exists public.workshop_avito_events (
 account_id text not null,message_id text not null check(length(message_id)<=200),
 chat_id text not null check(length(chat_id)<=200),created_at timestamptz not null,
 title text not null check(length(title)<=300),sender text not null default '' check(length(sender)<=200),
 body text not null check(length(body)<=5000),received_at timestamptz not null default now(),
 primary key(account_id,message_id)
);
create index if not exists workshop_avito_events_time on public.workshop_avito_events(account_id,created_at desc);
create table if not exists public.workshop_avito_reads (
 profile_id uuid not null references public.workshop_members(profile_id) on delete cascade,
 account_id text not null,message_id text not null,read_at timestamptz not null default now(),
 primary key(profile_id,account_id,message_id),
 foreign key(account_id,message_id) references public.workshop_avito_events(account_id,message_id) on delete cascade
);
alter table public.workshop_avito_connection enable row level security;
alter table public.workshop_avito_events enable row level security;
alter table public.workshop_avito_reads enable row level security;
revoke all on public.workshop_avito_connection,public.workshop_avito_events,public.workshop_avito_reads from public,anon,authenticated;
grant select,insert,update,delete on public.workshop_avito_connection,public.workshop_avito_events,public.workshop_avito_reads to service_role;
create or replace function public.workshop_avito_credentials(p_secret jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,vault,pg_temp as $$
declare v_id uuid;v_value text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Forbidden';end if;
 select id into v_id from vault.secrets where name='fastgo_avito_credentials';
 if p_secret is not null then
  if jsonb_typeof(p_secret)<>'object' or length(p_secret::text)>8192 then raise exception 'Invalid secret';end if;
  if v_id is null then perform vault.create_secret(p_secret::text,'fastgo_avito_credentials','FastGo Avito API credentials');
  else perform vault.update_secret(v_id,p_secret::text);end if;
  return jsonb_build_object('saved',true);
 end if;
 if v_id is null then return null;end if;
 select decrypted_secret into v_value from vault.decrypted_secrets where id=v_id;
 return v_value::jsonb;
end $$;
revoke all on function public.workshop_avito_credentials(jsonb) from public,anon,authenticated;
grant execute on function public.workshop_avito_credentials(jsonb) to service_role;
create or replace function public.workshop_avito_connect(p_secret jsonb,p_account_id text,p_label text,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,vault,pg_temp as $$
begin
 if current_user not in ('service_role','postgres') then raise exception 'Forbidden';end if;
 if p_account_id !~ '^[0-9]{1,20}$' or not exists(select 1 from public.workshop_members where profile_id=p_actor and active and role in ('owner','developer')) then raise exception 'Forbidden';end if;
 perform public.workshop_avito_credentials(p_secret||jsonb_build_object('account_id',p_account_id));
 update public.workshop_avito_connection set account_id=p_account_id,label=left(p_label,200),enabled=true,connected_by=p_actor,connected_at=now(),next_poll_at=now(),last_error='',chat_cursors='{}'::jsonb where id=1;
 return jsonb_build_object('connected',true,'label',left(p_label,200));
end $$;
revoke all on function public.workshop_avito_connect(jsonb,text,text,uuid) from public,anon,authenticated;
grant execute on function public.workshop_avito_connect(jsonb,text,text,uuid) to service_role;
