-- The Google warehouse is authoritative. Keep legacy rows readable, reject
-- every legacy inventory mutation, including writes by service_role and old bots.
create or replace function public.reject_legacy_inventory_write()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  raise exception using errcode='55000',
    message='LEGACY_INVENTORY_READ_ONLY: Склад перенесён в Google. Проводите приход и продажу в мастерской FastGo.';
end;
$$;
revoke all on function public.reject_legacy_inventory_write() from public,anon,authenticated;
do $$
declare target text;
begin
  foreach target in array array[
    'parts','stock_movements','service_stock_receipts','service_stock_receipt_items',
    'service_sales_reports','service_sales_report_items','workshop_sales','workshop_sale_items'
  ] loop
    execute format('drop trigger if exists fastgo_legacy_inventory_read_only on public.%I',target);
    execute format('create trigger fastgo_legacy_inventory_read_only before insert or update or delete or truncate on public.%I for each statement execute function public.reject_legacy_inventory_write()',target);
  end loop;
end;
$$;
