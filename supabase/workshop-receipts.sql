CREATE OR REPLACE FUNCTION public.workshop_native_commit(p_actor uuid, p_action text, p_request_id uuid, p_fingerprint text, p_version bigint, p_changes jsonb, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare st workshop_native_state; old workshop_native_receipts; c jsonb; col text; newversion bigint; receiptrow integer; receiptvalues jsonb; changes jsonb:=p_changes;begin
 if not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('developer','owner','admin','receiver','manager','mechanic','seller')) then raise exception 'Нет доступа' using errcode='42501';end if;
 if p_action in ('stock_receive','sale','shift_open','shift_close') and not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('developer','owner','seller')) then raise exception 'Нет доступа к кассе' using errcode='42501';end if;
 if exists(select 1 from workshop_members where profile_id=p_actor and role='seller') and p_action not in ('stock_receive','sale','shift_open','shift_close') then raise exception 'Нет доступа' using errcode='42501';end if;
 select * into st from workshop_native_state where id=1 for update;
 if st.mode<>'active' then raise exception 'Рабочая база ещё не переключена';end if;
 select * into old from workshop_native_receipts where request_id=p_request_id;
 if found then if old.actor_id<>p_actor or old.action<>p_action or old.fingerprint<>p_fingerprint then raise exception 'Код операции уже использован';end if;return jsonb_build_object('result',old.result,'replayed',true);end if;
 if st.version<>p_version then return jsonb_build_object('retry',true);end if;
 if p_request_id is null or p_fingerprint !~ '^[0-9a-f]{64}$' or length(p_result::text)>45000 or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>500 then raise exception 'Неверная операция';end if;
 newversion:=st.version+1;
 select coalesce(max(row_no),1)+1 into receiptrow from workshop_native_rows where sheet='Операции API';
 receiptvalues:=jsonb_build_object('request_id',p_request_id,'actor_id',p_actor,'action',p_action,'fingerprint',p_fingerprint,'result',p_result::text,'created_at',now());
 changes:=changes||jsonb_build_array(jsonb_build_object('sheet','Операции API','row',receiptrow,'values',receiptvalues));
 for c in select * from jsonb_array_elements(changes) loop
  if not exists(select 1 from workshop_native_sheets where name=c->>'sheet') or (c->>'row')::integer<2 or jsonb_typeof(c->'values')<>'object' then raise exception 'Неверная строка';end if;
  for col in select jsonb_object_keys(c->'values') loop if not exists(select 1 from workshop_native_sheets where name=c->>'sheet' and headers ? col) then raise exception 'Неизвестный столбец %',col;end if;end loop;
  insert into workshop_native_rows(sheet,row_no,data) values(c->>'sheet',(c->>'row')::integer,(select jsonb_object_agg(h,'') from workshop_native_sheets n,jsonb_array_elements_text(n.headers) h where n.name=c->>'sheet')||(c->'values')) on conflict(sheet,row_no) do update set data=workshop_native_rows.data||(c->'values');
 end loop;
 insert into workshop_native_receipts(request_id,actor_id,action,fingerprint,result) values(p_request_id,p_actor,p_action,p_fingerprint,p_result);
 insert into workshop_native_outbox(version,request_id,changes) values(newversion,p_request_id,changes);
 update workshop_native_state set version=newversion where id=1;
 return jsonb_build_object('result',p_result,'version',newversion);
end $function$
;

revoke all on function public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb) to service_role;
