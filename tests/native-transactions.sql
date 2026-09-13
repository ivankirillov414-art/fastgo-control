begin;
do $$
declare actor uuid; req uuid:=gen_random_uuid(); v bigint; rowid integer; result jsonb; job jsonb; count_before bigint; rejected boolean:=false;
begin
 select profile_id into actor from public.workshop_members where active and role='owner' limit 1;
 select version into v from public.workshop_native_state where id=1;
 select row_no into rowid from public.workshop_native_rows where sheet='Товары' and data->>'Штрих-код'='FGP-00000081';
 if rowid is null then raise exception 'Expected migration test product';end if;
 update public.workshop_native_state set mode='active' where id=1;
 select count(*) into count_before from public.workshop_native_outbox;
 result:=public.workshop_native_commit(actor,'stock',req,repeat('a',64),v,jsonb_build_array(jsonb_build_object('sheet','Товары','row',rowid,'values',jsonb_build_object('Остаток, шт.',0))),jsonb_build_object('test',true));
 if (select (data->>'Остаток, шт.')::integer from public.workshop_native_rows where sheet='Товары' and row_no=rowid)<>0 or (select count(*) from public.workshop_native_outbox)<>count_before+1 then raise exception 'Atomic commit failed';end if;
 result:=public.workshop_native_commit(actor,'stock',req,repeat('a',64),v,'[]','{}');
 if result->>'replayed'<>'true' or (select count(*) from public.workshop_native_outbox)<>count_before+1 then raise exception 'Idempotency failed';end if;
 result:=public.workshop_native_commit(actor,'stock',gen_random_uuid(),repeat('b',64),v,'[]','{}');
 if result->>'retry'<>'true' then raise exception 'Concurrent write not fenced';end if;
 begin
  perform public.workshop_native_commit(actor,'stock',gen_random_uuid(),repeat('c',64),v+1,jsonb_build_array(jsonb_build_object('sheet','Товары','row',rowid,'values',jsonb_build_object('Остаток, шт.',99)),jsonb_build_object('sheet','INVALID','row',2,'values','{}'::jsonb)),'{}');
 exception when others then rejected:=true;end;
 if not rejected or (select (data->>'Остаток, шт.')::integer from public.workshop_native_rows where sheet='Товары' and row_no=rowid)<>0 then raise exception 'Partial write was not rolled back';end if;
 job:=public.workshop_native_claim();perform public.workshop_native_ack((job->>'id')::bigint,(job->>'lease')::uuid,'simulated uncertain Google response');
 if public.workshop_native_claim()->>'busy'<>'true' then raise exception 'Uncertain Google write was retried too soon';end if;
 if has_function_privilege('authenticated','public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb)','execute') or has_table_privilege('anon','public.workshop_native_rows','select') then raise exception 'Private server API exposed';end if;
end $$;
rollback;
select 'PASS: atomic write/outbox, replay, competing version, full rollback, replica retry fence, private API. All test mutations rolled back.' as verification;
