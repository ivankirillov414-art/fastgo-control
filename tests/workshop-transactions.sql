begin;
do $$
declare owner_id uuid; rec jsonb; sid uuid; rid uuid; part_id uuid; key_id uuid:=gen_random_uuid(); revision_now integer; n integer; paid numeric;
begin
 select profile_id into owner_id from workshop_members where role='owner' and active limit 1;
 if owner_id is null then raise exception 'No owner available'; end if;
 rec:=workshop_mutate(owner_id,'create',jsonb_build_object('kind','storage','request_id',key_id,'last_name','Тест','first_name','Проверка','phone','+70000000000','brand','QA','model','Test','storage_tariff','monthly','storage_months',2,'starts_on','2026-09-10','planned_return_date','2026-11-10','wash',true,'storage_amount',1));
 sid:=(rec->>'id')::uuid;
 if (rec->>'storage_amount')::numeric<>4480 then raise exception 'Tariff calculated incorrectly'; end if;
 rec:=workshop_mutate(owner_id,'create',jsonb_build_object('kind','storage','request_id',key_id));
 if (rec->>'id')::uuid<>sid then raise exception 'Intake retry duplicated'; end if;
 begin
  perform workshop_mutate(gen_random_uuid(),'update',jsonb_build_object('kind','storage','id',sid));
  raise exception 'Unauthorized actor accepted';
 exception when insufficient_privilege then null; end;
 insert into parts(name,quantity,retail_price) values('QA TRANSACTION ONLY',5,100) returning id into part_id;
 rec:=workshop_mutate(owner_id,'create',jsonb_build_object('kind','repair','request_id',gen_random_uuid(),'last_name','Тест','first_name','Проверка','phone','+70000000000','brand','QA','model','Test','storage_id',sid));
 rid:=(rec->>'id')::uuid;
 rec:=workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',1,'works',jsonb_build_array(jsonb_build_object('name','Работа','price',700,'quantity',1)),'parts',jsonb_build_array(jsonb_build_object('part_id',part_id,'name','Запчасть','price',100,'quantity',2)),'total_amount',1));
 if (rec->>'total_amount')::numeric<>900 then raise exception 'Order totals trust client'; end if;
 select quantity into n from parts where id=part_id;
 if n<>3 then raise exception 'Stock consumption failed'; end if;
 begin
  perform workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',1,'status','diagnostics'));
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 begin
  perform workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',2,'parts',jsonb_build_array(jsonb_build_object('part_id',part_id,'name','Запчасть','price',100,'quantity',8))));
  raise exception 'Negative inventory accepted';
 exception when others then if sqlerrm<>'Insufficient stock' then raise; end if; end;
 select quantity into n from parts where id=part_id;
 if n<>3 then raise exception 'Failed operation changed inventory'; end if;
 rec:=workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',2,'status','repair','approve',true,'approval_note','Согласовано лично'));
 select quantity into n from parts where id=part_id;
 if n<>3 then raise exception 'Repeated save duplicated consumption'; end if;
 rec:=workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',3,'status','ready','quality_checked',true));
 begin
  perform workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',4,'status','issued','handover_notes','Проверено'));
  raise exception 'Unpaid handover accepted';
 exception when others then if sqlerrm not like 'Для выдачи%' then raise; end if; end;
 key_id:=gen_random_uuid();
 rec:=workshop_mutate(owner_id,'payment',jsonb_build_object('kind','repair','id',rid,'request_id',key_id,'amount',300,'method','cash'));
 rec:=workshop_mutate(owner_id,'payment',jsonb_build_object('kind','repair','id',rid,'request_id',key_id,'amount',300,'method','cash'));
 if (rec->>'paid_amount')::numeric<>300 then raise exception 'Duplicate payment'; end if;
 rec:=workshop_mutate(owner_id,'payment',jsonb_build_object('kind','repair','id',rid,'request_id',gen_random_uuid(),'amount',600,'method','card'));
 rec:=workshop_mutate(owner_id,'update',jsonb_build_object('kind','repair','id',rid,'revision',(rec->>'revision')::integer,'status','issued','handover_notes','Комплектность проверена, выдано клиенту'));
 if rec->>'issued_at' is null then raise exception 'Handover timestamp missing'; end if;
 if has_function_privilege('anon','public.workshop_mutate(uuid,text,jsonb)','EXECUTE') then raise exception 'Anonymous RPC access'; end if;
 if has_table_privilege('anon','public.service_repairs','SELECT') then raise exception 'Anonymous repair access'; end if;
 key_id:=gen_random_uuid();
 rec:=workshop_mutate(owner_id,'extend',jsonb_build_object('kind','storage','id',sid,'revision',1,'request_id',key_id,'months',1,'note','Согласовано лично'));
 if (rec->>'storage_amount')::numeric<>6470 or rec->>'planned_return_date'<>'2026-12-10' then raise exception 'Extension failed'; end if;
 rec:=workshop_mutate(owner_id,'extend',jsonb_build_object('kind','storage','id',sid,'revision',1,'request_id',key_id,'months',1,'note','Согласовано лично'));
 if (rec->>'storage_amount')::numeric<>6470 then raise exception 'Duplicate extension'; end if;
 rec:=workshop_mutate(owner_id,'documents',jsonb_build_object('kind','storage','id',sid,'slot','signed','paths',jsonb_build_array('workshop/storage/'||sid||'/test.pdf')));
 rec:=workshop_mutate(owner_id,'documents',jsonb_build_object('kind','storage','id',sid,'slot','signed','paths',jsonb_build_array('workshop/storage/'||sid||'/test.pdf')));
 if jsonb_array_length(rec->'signed_document_paths')<>1 then raise exception 'Duplicate attachment reference'; end if;
 perform workshop_read(owner_id,'overview','{}');
 perform workshop_read(owner_id,'customers','{}');
 perform workshop_read(owner_id,'finance','{}');
 perform workshop_read(owner_id,'legacy','{}');
 select id into key_id from service_orders where status not in ('closed','cancelled') limit 1;
 if key_id is not null then
  rec:=workshop_mutate(owner_id,'import_legacy',jsonb_build_object('id',key_id));
  rid:=(rec->>'id')::uuid;
  rec:=workshop_mutate(owner_id,'import_legacy',jsonb_build_object('id',key_id));
  if (rec->>'id')::uuid<>rid then raise exception 'Duplicate legacy continuation'; end if;
 end if;
end $$;
rollback;
