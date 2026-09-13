-- Migration transport probe. Run only after final Google/staging equality checks.
-- No employee is impersonated, no order/stock/payment is changed.
-- The reserved system actor labels an outbox-only migration receipt. The worker
-- rewrites the QA product's existing barcode with exactly the same value.
begin;
do $$
declare st public.workshop_native_state; r public.workshop_native_rows; request uuid:=gen_random_uuid();
begin
 select * into st from public.workshop_native_state where id=1 for update;
 if st.mode<>'staging' or (select storage_mode from public.workshop_backend_config where id=1)<>'paused'
    or st.mirror_seen_at is null or st.mirror_seen_at<now()-interval '3 minutes'
    or st.mirror_verified_at is null or st.mirror_verified_at<now()-interval '15 minutes'
    or exists(select 1 from public.workshop_native_outbox) then
  raise exception 'Cutover probe preconditions not met';
 end if;
 select * into r from public.workshop_native_rows where sheet='Товары' and data->>'Штрих-код'='FGP-00000081';
 if r.row_no is null then raise exception 'Expected existing QA product';end if;
 insert into public.workshop_native_receipts(request_id,actor_id,action,fingerprint,result)
 values(request,'00000000-0000-0000-0000-000000000000','migration_probe',repeat('0',64),'{"type":"replica_probe","business_data_changed":false}');
 insert into public.workshop_native_outbox(version,request_id,changes)
 values(st.version+1,request,jsonb_build_array(jsonb_build_object('sheet',r.sheet,'row',r.row_no,'values',jsonb_build_object('Штрих-код',r.data->'Штрих-код'))));
 update public.workshop_native_state set version=version+1 where id=1;
end $$;
commit;
select id,state,created_at from public.workshop_native_outbox order by id desc limit 1;
