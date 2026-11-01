-- Preserve the deployed native transaction and all of its existing guards.
-- Only trusted cash administrators may submit a payment correction.
do $migration$
declare definition text; marker text := ' select * into st from workshop_native_state where id=1 for update;';
begin
 definition := pg_get_functiondef('public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb)'::regprocedure);
 if position('payment_correction_cash_admin_guard' in definition)=0 then
  if position(marker in definition)=0 then raise exception 'Native commit changed; review the payment correction guard';end if;
  definition := replace(definition,marker,$guard$
 -- payment_correction_cash_admin_guard
 if p_action='warehouse_payment_correction' and not exists(
  select 1 from workshop_members where profile_id=p_actor and active
   and (role in ('owner','developer') or (role='admin' and can_sell))
 ) then raise exception 'Исправление оплат доступно владельцу или администратору кассы' using errcode='42501';end if;
$guard$ || marker);
  execute definition;
 end if;
end $migration$;

-- An edited payment can complete a prepared repair, using the same transactional
-- print outbox. No historical payments are replayed or backfilled.
drop trigger if exists workshop_print_paid_repair on public.workshop_native_receipts;
create trigger workshop_print_paid_repair after insert on public.workshop_native_receipts for each row
 when (new.action in ('warehouse_repair_payment','warehouse_payment_correction') and new.result->'repair_completed'='true'::jsonb)
 execute function public.workshop_print_paid_repair();
