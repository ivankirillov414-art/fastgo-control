-- Only these two station slots may receive terminal documents.
create table if not exists public.workshop_terminal_stations(
 slot smallint primary key check(slot in (1,2)),
 station_id uuid not null unique references public.workshop_warehouse_devices(id),
 created_at timestamptz not null default now()
);
alter table public.workshop_terminal_stations enable row level security;
revoke all on public.workshop_terminal_stations from public,anon,authenticated;
grant all on public.workshop_terminal_stations to service_role;
-- Retain the station already paired to the physical terminal. Never delete old devices.
insert into public.workshop_terminal_stations(slot,station_id)
select 1,station_id from public.workshop_warehouse_devices
where kind='terminal' and active and station_id is not null order by created_at desc limit 1
on conflict do nothing;
create or replace function public.warehouse_register_terminal_station(p_id uuid,p_name text,p_token_hash text,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare free_slot smallint;
begin
 perform pg_advisory_xact_lock(hashtext('fastgo-terminal-station-enrollment'));
 if not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('owner','developer')) then
  raise exception 'Разрешить ноутбук для ТСД может только владелец';
 end if;
 if exists(select 1 from workshop_warehouse_devices d join workshop_terminal_stations a on a.station_id=d.id where d.id=p_id and d.kind='station' and d.active and d.created_by=p_actor and d.token_hash=p_token_hash) then return jsonb_build_object('id',p_id,'name',p_name);end if;
 select s into free_slot from generate_series(1,2) s where not exists(select 1 from workshop_terminal_stations where slot=s) order by s limit 1;
 if free_slot is null then raise exception 'Для ТСД уже разрешены два ноутбука';end if;
 insert into workshop_warehouse_devices(id,kind,name,token_hash,created_by) values(p_id,'station',p_name,p_token_hash,p_actor);
 insert into workshop_terminal_stations(slot,station_id) values(free_slot,p_id);
 return jsonb_build_object('id',p_id,'name',p_name);
end $$;
revoke all on function public.warehouse_register_terminal_station(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.warehouse_register_terminal_station(uuid,text,text,uuid) to service_role;
