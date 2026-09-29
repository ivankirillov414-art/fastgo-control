begin;
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.workshop_members'::regclass and contype='c' and pg_get_constraintdef(oid) like '%role%' loop execute format('alter table public.workshop_members drop constraint %I',c.conname);end loop;
end $$;
alter table public.workshop_members add constraint workshop_members_role_check check(role in ('developer','owner','admin','receiver','manager','mechanic','seller'));
CREATE OR REPLACE FUNCTION public.workshop_native_commit(p_actor uuid, p_action text, p_request_id uuid, p_fingerprint text, p_version bigint, p_changes jsonb, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare st workshop_native_state; old workshop_native_receipts; c jsonb; col text; newversion bigint; receiptrow integer; receiptvalues jsonb; changes jsonb:=p_changes;begin
 if not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('developer','owner','admin','receiver','manager','mechanic','seller')) then raise exception 'Нет доступа' using errcode='42501';end if;
 if p_action in ('sale','shift_open','shift_close') and not exists(select 1 from workshop_members where profile_id=p_actor and active and role in ('developer','owner','seller')) then raise exception 'Нет доступа к кассе' using errcode='42501';end if;
 if exists(select 1 from workshop_members where profile_id=p_actor and role='seller') and p_action not in ('sale','shift_open','shift_close') then raise exception 'Нет доступа' using errcode='42501';end if;
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
CREATE OR REPLACE FUNCTION public.workshop_mutate(p_actor uuid, p_action text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 m workshop_members; rr service_repairs; ss storage_intakes; rec jsonb; old jsonb; item jsonb;
 k text:=coalesce(p->>'kind','repair'); rid uuid; reqid uuid; st text; oldst text;
 total numeric:=0; labor numeric:=0; parts_total numeric:=0; paid numeric:=0; amt numeric;
 works_new jsonb; parts_new jsonb; oldparts jsonb; pid uuid; delta integer; oldq integer; newq integer;
 change record; legacy record; assignment uuid; role_allowed boolean; revision_old integer; dates date;
begin
 select * into m from workshop_members where profile_id=p_actor and active;
 if not found then raise exception 'Доступ сотрудника не подтверждён' using errcode='42501'; end if;
 role_allowed:=m.role in ('owner','admin','receiver','manager');
 if p_action='member_update' then
  if m.role not in ('developer','owner','admin') then raise exception 'Нет права управлять сотрудниками' using errcode='42501'; end if;
  if p->>'role'='owner' and m.role not in ('developer','owner') then raise exception 'Только владелец назначает владельца'; end if;
  if (p->>'profile_id')::uuid=p_actor then raise exception 'Собственный доступ здесь изменить нельзя'; end if;
  if exists(select 1 from workshop_members where profile_id=(p->>'profile_id')::uuid and role='owner') and m.role not in ('developer','owner') then raise exception 'Только владелец меняет доступ владельца'; end if;
  insert into workshop_members(profile_id,name,role,active,tags) values((p->>'profile_id')::uuid,left(p->>'name',100),p->>'role',coalesce((p->>'active')::boolean,true),array(select jsonb_array_elements_text(coalesce(p->'tags','[]'))))
   on conflict(profile_id) do update set name=excluded.name,role=excluded.role,active=excluded.active,tags=excluded.tags;
  insert into workshop_events(kind,record_id,action,actor_id,details) values('staff',(p->>'profile_id')::uuid,p_action,p_actor,p-'password');
  return jsonb_build_object('ok',true);
 end if;
 if p_action='import_legacy' then
  if not role_allowed then raise exception 'Нет права переносить заказ' using errcode='42501'; end if;
  select o.*,c.full_name,c.phone,a.brand,a.model,a.serial_number into legacy from service_orders o join service_customers c on c.id=o.customer_id join service_assets a on a.id=o.asset_id where o.id=(p->>'id')::uuid for update of o;
  if not found then raise exception 'Прежний заказ не найден'; end if;
  select to_jsonb(r) into rec from service_repairs r where legacy_order_id=legacy.id;
  if rec is not null then return rec; end if;
  if legacy.status in ('closed','cancelled') then raise exception 'Этот прежний заказ уже закрыт'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',title,'price',labor_price,'quantity',quantity)) filter(where labor_price>0),'[]'),coalesce(jsonb_agg(jsonb_build_object('name',title||' (запчасти)','price',parts_price,'quantity',quantity)) filter(where parts_price>0),'[]'),coalesce(sum(labor_price*quantity),0),coalesce(sum(parts_price*quantity),0)
   into works_new,parts_new,labor,parts_total from service_order_items where order_id=legacy.id;
  if labor+parts_total=0 and coalesce(legacy.final_price,legacy.estimated_price,0)>0 then labor:=coalesce(legacy.final_price,legacy.estimated_price);works_new:=jsonb_build_array(jsonb_build_object('name','Работы прежнего заказа','price',labor,'quantity',1));end if;
  insert into service_repairs(legacy_order_id,last_name,first_name,middle_name,phone,brand,model,serial_number,issue_description,condition_notes,diagnostics_notes,works,parts,labor_amount,parts_amount,total_amount,created_at)
  values(legacy.id,coalesce(nullif(split_part(legacy.full_name,' ',1),''),'Клиент'),coalesce(nullif(split_part(legacy.full_name,' ',2),''),'Не указано'),split_part(legacy.full_name,' ',3),legacy.phone,coalesce(legacy.brand,'Не указан'),coalesce(legacy.model,'Не указана'),legacy.serial_number,legacy.reason,legacy.intake_condition,legacy.performed_work,works_new,parts_new,labor,parts_total,labor+parts_total,legacy.created_at)
   returning to_jsonb(service_repairs.*) into rec;
  insert into workshop_events(kind,record_id,action,actor_id,details) values('repair',(rec->>'id')::uuid,'import_legacy',p_actor,jsonb_build_object('note','Продолжение заказа '||legacy.order_code,'legacy_order_id',legacy.id));
  return rec;
 end if;
 if p_action='stock' then
  if not role_allowed then raise exception 'Нет права изменять склад' using errcode='42501'; end if;
  reqid:=(p->>'request_id')::uuid;
  if reqid is null then raise exception 'Нет ключа операции'; end if;
  perform pg_advisory_xact_lock(hashtextextended(reqid::text,0));
  if exists(select 1 from stock_movements where workshop_request_id=reqid) then return jsonb_build_object('ok',true); end if;
  if p->>'movement_type' not in ('receipt','issue') then raise exception 'Неизвестный тип движения'; end if;
  if coalesce(p->>'note','')='' then raise exception 'Укажите основание движения'; end if;
  insert into stock_movements(part_id,movement_type,quantity,actor_id,note,workshop_request_id)
   values((p->>'part_id')::uuid,(p->>'movement_type')::stock_movement_type,(p->>'quantity')::integer,p_actor,p->>'note',reqid);
  return jsonb_build_object('ok',true);
 end if;
 if k not in ('repair','storage') then raise exception 'Неверный вид заказа'; end if;
 if p_action='create' then
  if not role_allowed then raise exception 'Нет права создавать приёмки' using errcode='42501'; end if;
  reqid:=(p->>'request_id')::uuid;
  if reqid is null then raise exception 'Нет ключа сохранения'; end if;
  perform pg_advisory_xact_lock(hashtextextended(reqid::text,0));
  if k='repair' then select to_jsonb(r) into rec from service_repairs r where request_id=reqid;
  else select to_jsonb(s) into rec from storage_intakes s where request_id=reqid; end if;
  if rec is not null then return rec; end if;
  foreach st in array array['last_name','first_name','phone','brand','model'] loop
   if length(trim(coalesce(p->>st,'')))=0 or length(p->>st)>200 then raise exception 'Проверьте обязательные поля'; end if;
  end loop;
  if p->>'phone' !~ '^\+7[0-9]{10}$' then raise exception 'Номер телефона: +7 и 10 цифр'; end if;
  if k='repair' then
   assignment:=nullif(p->>'assigned_master_id','')::uuid;
   if p->>'auto_assign'='true' then
    select w.profile_id into assignment from workshop_members w where w.active and w.role='mechanic'
     and (coalesce(jsonb_array_length(p->'tags'),0)=0 or w.tags && array(select jsonb_array_elements_text(p->'tags')))
     order by (select count(*) from service_repairs r where r.assigned_master_id=w.profile_id and r.status not in ('issued','cancelled')),w.created_at limit 1;
   end if;
   if assignment is not null and not exists(select 1 from workshop_members where profile_id=assignment and active) then raise exception 'Мастер неактивен'; end if;
   if nullif(p->>'storage_id','') is not null and not exists(select 1 from storage_intakes where id=(p->>'storage_id')::uuid and status not in ('returned','cancelled')) then raise exception 'Приёмка хранения закрыта'; end if;
   insert into service_repairs(request_id,last_name,first_name,middle_name,phone,email,vehicle_type,brand,model,serial_number,issue_description,condition_notes,accessories,promised_date,assigned_master_id,assigned_master,storage_id,tags)
    values(reqid,trim(p->>'last_name'),trim(p->>'first_name'),p->>'middle_name',p->>'phone',p->>'email',coalesce(p->>'vehicle_type','Электросамокат'),p->>'brand',p->>'model',p->>'serial_number',p->>'issue_description',p->>'condition_notes',p->>'accessories',nullif(p->>'promised_date','')::date,assignment,(select name from workshop_members where profile_id=assignment),nullif(p->>'storage_id','')::uuid,array(select jsonb_array_elements_text(coalesce(p->'tags','[]')))) returning to_jsonb(service_repairs.*) into rec;
  else
   if p->>'storage_tariff' not in ('monthly','season') then raise exception 'Выберите тариф'; end if;
   if p->>'storage_tariff'='monthly' and (coalesce((p->>'storage_months')::integer,0)<1 or (p->>'storage_months')::integer>12) then raise exception 'Срок хранения: от 1 до 12 месяцев'; end if;
   dates:=(p->>'starts_on')::date;
   if dates is null or nullif(p->>'planned_return_date','') is null or (p->>'planned_return_date')::date<dates then raise exception 'Проверьте даты хранения'; end if;
   amt:=case when p->>'storage_tariff'='season' then 7990 else 1990*(p->>'storage_months')::integer end + case when p->>'wash'='true' then 500 else 0 end;
   insert into storage_intakes(request_id,last_name,first_name,middle_name,phone,email,brand,model,serial_number,issue_description,condition_notes,accessories,starts_on,planned_return_date,storage_location,storage_tariff,storage_months,storage_amount,wash)
    values(reqid,trim(p->>'last_name'),trim(p->>'first_name'),p->>'middle_name',p->>'phone',p->>'email',p->>'brand',p->>'model',p->>'serial_number',p->>'issue_description',p->>'condition_notes',p->>'accessories',dates,(p->>'planned_return_date')::date,p->>'storage_location',p->>'storage_tariff',case when p->>'storage_tariff'='monthly' then (p->>'storage_months')::integer else null end,amt,coalesce((p->>'wash')::boolean,false)) returning to_jsonb(storage_intakes.*) into rec;
  end if;
  insert into workshop_events(kind,record_id,action,actor_id,details) values(k,(rec->>'id')::uuid,'create',p_actor,jsonb_build_object('status','accepted'));
  return rec;
 end if;
 rid:=(p->>'id')::uuid;
 if k='repair' then
  select * into rr from service_repairs where id=rid for update;
  if not found then raise exception 'Заказ не найден'; end if;
  rec:=to_jsonb(rr); total:=rr.total_amount; paid:=rr.paid_amount;
  if m.role='mechanic' and rr.assigned_master_id is distinct from p_actor then raise exception 'Заказ назначен другому мастеру' using errcode='42501'; end if;
 else
  if not role_allowed then raise exception 'Нет доступа к хранению' using errcode='42501'; end if;
  select * into ss from storage_intakes where id=rid for update;
  if not found then raise exception 'Приёмка не найдена'; end if;
  rec:=to_jsonb(ss); total:=coalesce(ss.storage_amount,0); paid:=ss.paid_amount;
 end if;
 old:=rec; oldst:=rec->>'status'; revision_old:=(rec->>'revision')::integer;
 if p_action='payment' then
  if not role_allowed then raise exception 'Нет права принимать оплату' using errcode='42501'; end if;
  reqid:=(p->>'request_id')::uuid;
  if reqid is null then raise exception 'Нет ключа оплаты'; end if;
  perform pg_advisory_xact_lock(hashtextextended(reqid::text,0));
  if exists(select 1 from workshop_payments where request_id=reqid) then return rec; end if;
  amt:=(p->>'amount')::numeric;
  if amt is null or amt=0 or round(amt,2)<>amt or abs(amt)>10000000 then raise exception 'Проверьте сумму'; end if;
  if oldst='cancelled' then raise exception 'Заказ отменён'; end if;
  if amt<0 and (m.role not in ('owner','admin') or coalesce(p->>'note','')='') then raise exception 'Возврат оформляет администратор с указанием причины'; end if;
  if paid+amt<0 or paid+amt>total then raise exception 'Сумма превышает остаток к оплате или возврату'; end if;
  if amt<0 and oldst in ('issued','returned') then raise exception 'Для возврата по выданной технике сначала откройте заказ повторно'; end if;
  insert into workshop_payments(request_id,repair_id,storage_id,amount,method,note,actor_id)
   values(reqid,case when k='repair' then rid end,case when k='storage' then rid end,amt,p->>'method',coalesce(p->>'note',''),p_actor);
  if k='repair' then update service_repairs set paid_amount=paid+amt,revision=revision+1,updated_at=now() where id=rid returning to_jsonb(service_repairs.*) into rec;
  else update storage_intakes set paid_amount=paid+amt,revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec; end if;
 elsif p_action='contact' then
  if not role_allowed then raise exception 'Приёмку редактирует приёмщик'; end if;
  if oldst in ('issued','returned','cancelled') then raise exception 'Приёмка закрыта'; end if;
  if (p->>'revision')::integer is distinct from revision_old then raise exception 'Карточка изменена. Обновите её' using errcode='40001'; end if;
  if length(trim(coalesce(p->>'last_name','')))=0 or length(trim(coalesce(p->>'first_name','')))=0 or length(trim(coalesce(p->>'brand','')))=0 or length(trim(coalesce(p->>'model','')))=0 or p->>'phone' !~ '^\+7[0-9]{10}$' then raise exception 'Проверьте обязательные поля'; end if;
  if k='repair' then update service_repairs set last_name=p->>'last_name',first_name=p->>'first_name',middle_name=p->>'middle_name',phone=p->>'phone',email=p->>'email',brand=p->>'brand',model=p->>'model',serial_number=p->>'serial_number',accessories=p->>'accessories',condition_notes=p->>'condition_notes',issue_description=p->>'issue_description',revision=revision+1,updated_at=now() where id=rid returning to_jsonb(service_repairs.*) into rec;
  else update storage_intakes set last_name=p->>'last_name',first_name=p->>'first_name',middle_name=p->>'middle_name',phone=p->>'phone',email=p->>'email',brand=p->>'brand',model=p->>'model',serial_number=p->>'serial_number',accessories=p->>'accessories',condition_notes=p->>'condition_notes',issue_description=p->>'issue_description',revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec; end if;
 elsif p_action='extend' then
  if k<>'storage' or not role_allowed or oldst in ('returned','cancelled') then raise exception 'Нельзя продлить эту приёмку'; end if;
  reqid:=(p->>'request_id')::uuid;
  if reqid is null then raise exception 'Нет ключа продления'; end if;
  if exists(select 1 from workshop_events where kind=k and record_id=rid and action='extend' and details->>'request_id'=reqid::text) then return rec; end if;
  if (p->>'revision')::integer is distinct from revision_old then raise exception 'Карточка изменена. Обновите её' using errcode='40001'; end if;
  newq:=(p->>'months')::integer;
  if newq is null or newq<1 or newq>12 then raise exception 'Продление: от 1 до 12 месяцев'; end if;
  if length(trim(coalesce(p->>'note','')))<3 then raise exception 'Укажите согласование продления с клиентом'; end if;
  update storage_intakes set planned_return_date=(planned_return_date+make_interval(months=>newq))::date,storage_amount=storage_amount+1990*newq,extension_months=extension_months+newq,extension_amount=extension_amount+1990*newq,revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec;
 elsif p_action='documents' then
  if jsonb_typeof(p->'paths')<>'array' or jsonb_array_length(p->'paths')<1 or jsonb_array_length(p->'paths')>20 then raise exception 'Выберите файлы'; end if;
  for item in select value from jsonb_array_elements(p->'paths') loop
   if item #>> '{}' not like 'workshop/'||k||'/'||rid||'/%' then raise exception 'Файл относится к другой приёмке'; end if;
  end loop;
  if p->>'slot'='signed' then
   if not role_allowed then raise exception 'Нет права прикреплять подписанные документы'; end if;
   if k='repair' then update service_repairs set signed_document_paths=(select jsonb_agg(distinct value) from jsonb_array_elements(signed_document_paths || (p->'paths'))),documents_uploaded_at=now(),revision=revision+1,updated_at=now() where id=rid returning to_jsonb(service_repairs.*) into rec;
   else update storage_intakes set signed_document_paths=(select jsonb_agg(distinct value) from jsonb_array_elements(signed_document_paths || (p->'paths'))),documents_uploaded_at=now(),revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec; end if;
  else
   if k='repair' then update service_repairs set fault_photo_paths=(select jsonb_agg(distinct value) from jsonb_array_elements(fault_photo_paths || (p->'paths'))),revision=revision+1,updated_at=now() where id=rid returning to_jsonb(service_repairs.*) into rec;
   else update storage_intakes set fault_photo_paths=(select jsonb_agg(distinct value) from jsonb_array_elements(fault_photo_paths || (p->'paths'))),revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec; end if;
  end if;
 elsif p_action='update' then
  if (p->>'revision')::integer is distinct from revision_old then raise exception 'Карточку уже изменили. Обновите её перед сохранением' using errcode='40001'; end if;
  st:=coalesce(p->>'status',oldst);
  if oldst in ('issued','returned','cancelled') then
   if m.role not in ('owner','admin') or st<>(case when k='repair' then 'accepted' else 'stored' end) or length(trim(coalesce(p->>'reopen_reason','')))<3 then raise exception 'Закрытый заказ может открыть администратор с указанием причины'; end if;
   if k='repair' then update service_repairs set status='accepted',issued_at=null,quality_checked=false,revision=revision+1,updated_at=now() where id=rid returning to_jsonb(service_repairs.*) into rec;
   else update storage_intakes set status='stored',issued_at=null,revision=revision+1,updated_at=now() where id=rid returning to_jsonb(storage_intakes.*) into rec; end if;
  elsif k='repair' then
   if not role_allowed and st in ('issued','cancelled') then raise exception 'Выдачу и отмену оформляет приёмщик'; end if;
   works_new:=coalesce(p->'works',rr.works); parts_new:=coalesce(p->'parts',rr.parts); oldparts:=rr.parts;
   if jsonb_typeof(works_new)<>'array' or jsonb_typeof(parts_new)<>'array' or jsonb_array_length(works_new)>100 or jsonb_array_length(parts_new)>100 then raise exception 'Некорректные работы или запчасти'; end if;
   for item in select value from jsonb_array_elements(works_new || parts_new) loop
    if length(trim(coalesce(item->>'name','')))=0 or coalesce((item->>'price')::numeric,-1)<0 or round((item->>'price')::numeric,2)<>(item->>'price')::numeric or (item->>'price')::numeric>10000000 or coalesce((item->>'quantity')::integer,1)<1 or coalesce((item->>'quantity')::integer,1)>1000 then raise exception 'Проверьте названия, цены и количество'; end if;
   end loop;
   select coalesce(sum((value->>'price')::numeric*coalesce((value->>'quantity')::integer,1)),0) into labor from jsonb_array_elements(works_new);
   select coalesce(sum((value->>'price')::numeric*coalesce((value->>'quantity')::integer,1)),0) into parts_total from jsonb_array_elements(parts_new);
   total:=round(labor+parts_total,2);
   if total<paid then raise exception 'Итог меньше уже оплаченной суммы. Сначала оформите возврат'; end if;
   if p->>'approve'='true' then
    if not role_allowed or length(trim(coalesce(p->>'approval_note','')))<3 then raise exception 'Укажите, как клиент согласовал стоимость'; end if;
    rr.approved_amount:=total; rr.approval_note:=p->>'approval_note';
   elsif rr.approved_amount is not null and rr.total_amount<>total then rr.approved_amount:=null; end if;
   if st in ('repair','ready','issued') and total>0 and coalesce(rr.approved_amount,-1)<>total then raise exception 'Сначала согласуйте текущую стоимость с клиентом'; end if;
   if st in ('ready','issued') and not coalesce((p->>'quality_checked')::boolean,rr.quality_checked) then raise exception 'Подтвердите проверку техники'; end if;
   if st='issued' and (oldst<>'ready' or paid<total or coalesce(p->>'handover_notes','')='') then raise exception 'Для выдачи нужны статус «Готов», полная оплата и отметка о проверке комплектности'; end if;
   if st='cancelled' and (paid<>0 or jsonb_array_length(parts_new)>0) then raise exception 'Перед отменой верните оплату и снимите установленные запчасти'; end if;
   assignment:=case when p ? 'assigned_master_id' then nullif(p->>'assigned_master_id','')::uuid else rr.assigned_master_id end;
   if not role_allowed and assignment is distinct from rr.assigned_master_id then raise exception 'Мастера назначает приёмщик'; end if;
   if assignment is not null and not exists(select 1 from workshop_members where profile_id=assignment and active) then raise exception 'Мастер неактивен'; end if;
   -- Serialize all affected parts in UUID order. Existing trigger prevents negative stock.
   for change in
    select part_id,sum(q)::integer dq from (
     select nullif(value->>'part_id','')::uuid part_id,coalesce((value->>'quantity')::integer,1) q from jsonb_array_elements(parts_new)
     union all select nullif(value->>'part_id','')::uuid,-coalesce((value->>'quantity')::integer,1) from jsonb_array_elements(oldparts)
    ) x where part_id is not null group by part_id order by part_id
   loop
    perform 1 from parts where id=change.part_id for update;
    if not found then raise exception 'Запчасть не найдена'; end if;
    if change.dq<>0 then insert into stock_movements(part_id,movement_type,quantity,actor_id,note,workshop_repair_id)
     values(change.part_id,case when change.dq>0 then 'issue'::stock_movement_type else 'return'::stock_movement_type end,abs(change.dq),p_actor,'Ремонт № '||rr.repair_number,rid); end if;
   end loop;
   update service_repairs set works=works_new,parts=parts_new,labor_amount=round(labor,2),parts_amount=round(parts_total,2),total_amount=total,status=st,
    diagnostics_notes=coalesce(p->>'diagnostics_notes',diagnostics_notes),assigned_master_id=assignment,assigned_master=(select name from workshop_members where profile_id=assignment),
    promised_date=case when p ? 'promised_date' then nullif(p->>'promised_date','')::date else promised_date end,
    approved_amount=rr.approved_amount,approval_note=rr.approval_note,quality_checked=coalesce((p->>'quality_checked')::boolean,quality_checked),
    handover_notes=coalesce(p->>'handover_notes',handover_notes),issued_at=case when st='issued' then now() else issued_at end,updated_at=now(),revision=revision+1
    where id=rid returning to_jsonb(service_repairs.*) into rec;
  else
   if st='stored' and length(trim(coalesce(p->>'storage_location',ss.storage_location,'')))=0 then raise exception 'Укажите место хранения'; end if;
   if st='returned' and (oldst<>'ready_return' or paid<total or coalesce(p->>'handover_notes','')='') then raise exception 'Для выдачи нужны готовность, полная оплата и отметка о комплектности'; end if;
   if st='returned' and exists(select 1 from service_repairs where storage_id=rid and status not in ('ready','issued','cancelled')) then raise exception 'Есть незавершённый ремонт этой техники'; end if;
   if st='cancelled' and paid<>0 then raise exception 'Перед отменой верните оплату'; end if;
   if nullif(p->>'planned_return_date','') is not null and (p->>'planned_return_date')::date<ss.starts_on then raise exception 'Проверьте дату выдачи'; end if;
   update storage_intakes set status=st,storage_location=coalesce(p->>'storage_location',storage_location),planned_return_date=coalesce(nullif(p->>'planned_return_date','')::date,planned_return_date),
    handover_notes=coalesce(p->>'handover_notes',handover_notes),issued_at=case when st='returned' then now() else issued_at end,updated_at=now(),revision=revision+1 where id=rid returning to_jsonb(storage_intakes.*) into rec;
  end if;
 else raise exception 'Неизвестная операция'; end if;
 insert into workshop_events(kind,record_id,action,actor_id,details) values(k,rid,p_action,p_actor,
  jsonb_build_object('from_status',oldst,'to_status',rec->>'status','total',case when k='repair' then rec->'total_amount' else rec->'storage_amount' end,'amount',p->'amount','request_id',p->>'request_id','months',p->'months','note',coalesce(p->>'note',p->>'reopen_reason',p->>'approval_note'),'revision',rec->'revision'));
 return rec;
end;
$function$
;
revoke all on function public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.workshop_native_commit(uuid,text,uuid,text,bigint,jsonb,jsonb) to service_role;
revoke all on function public.workshop_mutate(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.workshop_mutate(uuid,text,jsonb) to service_role;
commit;
