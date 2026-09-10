begin;
create or replace function public.workshop_read(p_actor uuid,p_action text,p jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare m workshop_members; result jsonb; today date:=(now() at time zone 'Asia/Yekaterinburg')::date;
begin
 select * into m from workshop_members where profile_id=p_actor and active;
 if not found then raise exception 'Нет доступа' using errcode='42501'; end if;
 if p_action='overview' then
  return jsonb_build_object(
   'repairs',(select count(*) from service_repairs where status not in ('issued','cancelled') and (m.role<>'mechanic' or assigned_master_id=p_actor)),
   'ready',(select count(*) from service_repairs where status='ready' and (m.role<>'mechanic' or assigned_master_id=p_actor)),
   'overdue',(select count(*) from service_repairs where status not in ('issued','cancelled','ready') and promised_date<today and (m.role<>'mechanic' or assigned_master_id=p_actor)),
   'storage',case when m.role<>'mechanic' then (select count(*) from storage_intakes where status not in ('returned','cancelled')) end,
   'storage_due',case when m.role<>'mechanic' then (select count(*) from storage_intakes where status not in ('returned','cancelled') and planned_return_date<=today+7) end,
   'debt',case when m.role<>'mechanic' then (select coalesce(sum(total_amount-paid_amount),0) from service_repairs where status<>'cancelled')+(select coalesce(sum(storage_amount-paid_amount),0) from storage_intakes where status<>'cancelled') end,
   'today_payments',case when m.role<>'mechanic' then (select coalesce(sum(amount),0) from workshop_payments where created_at >= today::timestamp at time zone 'Asia/Yekaterinburg') end,
   'low_stock',(select count(*) from parts where quantity<=2));
 end if;
 if m.role='mechanic' then raise exception 'Нет доступа к этому разделу' using errcode='42501'; end if;
 if p_action='customers' then
  with all_orders as (
   select phone,last_name||' '||first_name||' '||coalesce(middle_name,'') full_name,brand||' '||model vehicle,total_amount-paid_amount debt,created_at from service_repairs where status<>'cancelled'
   union all select phone,last_name||' '||first_name||' '||coalesce(middle_name,''),brand||' '||model,coalesce(storage_amount,0)-paid_amount,created_at from storage_intakes where status<>'cancelled'
  ), grouped as (select phone,(array_agg(full_name order by created_at desc))[1] full_name,array_agg(distinct vehicle) vehicles,count(*) orders,sum(debt) debt,max(created_at) last_visit from all_orders group by phone),
  filtered as (select * from grouped where full_name ilike '%'||coalesce(p->>'search','')||'%' or phone ilike '%'||coalesce(p->>'search','')||'%')
  select jsonb_build_object('count',(select count(*) from filtered),'items',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into result from (select * from filtered order by last_visit desc limit 100 offset greatest(coalesce((p->>'offset')::integer,0),0)) x;
  return result;
 end if;
 if p_action='finance' then
  with filtered as (select * from workshop_payments where created_at >= coalesce(nullif(p->>'from','')::date,today-30)::timestamp at time zone 'Asia/Yekaterinburg' and created_at < (coalesce(nullif(p->>'to','')::date,today)+1)::timestamp at time zone 'Asia/Yekaterinburg')
  select jsonb_build_object('total',(select coalesce(sum(amount),0) from filtered),'cash',(select coalesce(sum(amount),0) from filtered where method='cash'),'card',(select coalesce(sum(amount),0) from filtered where method='card'),'transfer',(select coalesce(sum(amount),0) from filtered where method='transfer'),'count',(select count(*) from filtered),'items',coalesce(jsonb_agg(to_jsonb(x)),'[]')) into result
   from (select f.*,r.repair_number,s.storage_number from filtered f left join service_repairs r on r.id=f.repair_id left join storage_intakes s on s.id=f.storage_id order by f.created_at desc limit 100 offset greatest(coalesce((p->>'offset')::integer,0),0)) x;
  return result;
 end if;
 if p_action='legacy' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select o.id,(select r.id from service_repairs r where r.legacy_order_id=o.id) new_repair_id,(select r.repair_number from service_repairs r where r.legacy_order_id=o.id) new_repair_number,o.order_code,o.status,o.reason,o.performed_work,o.estimated_price,o.final_price,o.created_at,c.full_name,c.phone,a.brand,a.model,a.serial_number,
    (select coalesce(jsonb_agg(to_jsonb(i)),'[]') from service_order_items i where i.order_id=o.id) items
   from service_orders o left join service_customers c on c.id=o.customer_id left join service_assets a on a.id=o.asset_id order by o.created_at desc limit 100
  ) x;return result;
 end if;
 raise exception 'Неизвестный раздел';
end;
$$;
revoke all on function public.workshop_read(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.workshop_read(uuid,text,jsonb) to service_role;
commit;
