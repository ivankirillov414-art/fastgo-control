-- Private device routing. Only the authenticated Edge service can read these rows.
create table if not exists public.workshop_warehouse_devices(
 id uuid primary key, kind text not null check(kind in ('station','terminal')),
 name text not null, token_hash text not null unique, station_id uuid references public.workshop_warehouse_devices(id),
 created_by uuid not null references auth.users(id), active boolean not null default true,
 pair_code text unique, pair_expires timestamptz, created_at timestamptz not null default now());
create table if not exists public.workshop_warehouse_queue(
 id uuid primary key, station_id uuid not null references public.workshop_warehouse_devices(id),
 terminal_id uuid not null references public.workshop_warehouse_devices(id), created_by uuid not null references auth.users(id),
 payload jsonb not null, state text not null default 'queued' check(state in ('queued','processing','done')),
 checkout jsonb, result jsonb, created_at timestamptz not null default now(), completed_at timestamptz);
create index if not exists warehouse_queue_station on public.workshop_warehouse_queue(station_id,state,created_at);
alter table public.workshop_warehouse_devices enable row level security;
alter table public.workshop_warehouse_queue enable row level security;
revoke all on public.workshop_warehouse_devices,public.workshop_warehouse_queue from public,anon,authenticated;
grant all on public.workshop_warehouse_devices,public.workshop_warehouse_queue to service_role;
create or replace function public.warehouse_pair(p_code text,p_id uuid,p_token_hash text,p_actor uuid,p_name text) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare station uuid;
begin
 select id into station from workshop_warehouse_devices where kind='station' and active and pair_code=p_code and pair_expires>now() for update;
 if station is null then raise exception 'Код привязки недействителен';end if;
 update workshop_warehouse_devices set pair_code=null,pair_expires=null where id=station;
 insert into workshop_warehouse_devices(id,kind,name,token_hash,station_id,created_by) values(p_id,'terminal',p_name,p_token_hash,station,p_actor);
 return station;
end $$;
revoke all on function public.warehouse_pair(text,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.warehouse_pair(text,uuid,text,uuid,text) to service_role;
