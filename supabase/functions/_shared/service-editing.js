const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const text=(v,max=500)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))fail('Проверьте текстовые поля');return v.trim();};
const money=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e8||Math.abs(v*100-Math.round(v*100))>.00001)fail('Проверьте сумму: до двух знаков после запятой');return v;};
const date=v=>{v=text(v,10);if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))fail('Проверьте дату');return v;};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const managers=['developer','owner','admin','receiver','manager'],staff=[...managers,'mechanic'],administrators=['developer','owner','admin'];
const fields={client:['last_name','first_name','middle_name','phone','email'],vehicle:['brand','model','serial_number','accessories','condition_notes','issue_description','promised_date'],diagnostics:['diagnostics_notes','promised_date','note'],handover:['warranty_days','handover_notes'],pricing:['discount','total_override','approve','approval_note'],works:['works'],parts_return:['source_index'],customer:['full_name','phone','email'],act:['works','parts','total_amount','document','reason']};
export function serviceEditingOperation(p,actor,h){
 if(!staff.includes(actor.role))fail('Нет доступа к сервису',403);
 const validId=p.group==='customer'?typeof p.id==='string'&&p.id.length>0&&p.id.length<=100&&!/[\x00-\x1f\x7f]/.test(p.id):uuid(p.id);
 if(!validId||!uuid(p.request_id)||!fields[p.group]||!object(p.values))fail('Проверьте данные изменения');
 if(Object.keys(p.values).some(k=>!fields[p.group].includes(k))||!Object.keys(p.values).length)fail('Поле нельзя изменить в этом разделе');
 if(['client','vehicle','handover','pricing','parts_return','customer'].includes(p.group)&&!managers.includes(actor.role))fail('Изменение доступно сотруднику приёмки или кассы',403);
 if(p.group==='customer')return editCustomer(p,actor,h);
 if(!Number.isSafeInteger(p.revision)||p.revision<1)fail('Нужна положительная целая версия ремонта');
 const raw=h.rows('Ремонты').find(x=>x.repair_id===p.id);if(!raw)fail('Ремонт не найден',404);
 h.access(actor,'repair',raw);const revision=h.revision(raw,p),r=h.map(raw),values={...p.values},reason=text(p.reason||'',500);
 const closed=['issued','cancelled'].includes(r.status);
 if(p.group==='act')return h.act({...values,id:p.id,revision,request_id:p.request_id},actor);
 if(closed&&(!administrators.includes(actor.role)||!reason))fail('Закрытая карточка: административная корректировка с причиной',403);
 if(['works','pricing'].includes(p.group)&&['ready','issued'].includes(r.status))fail('Измените завершённые работы через «Исправить акт»',409);
 if(closed&&p.group==='parts_return')fail('Сначала откройте ремонт повторно; возврат детали оформляется на кассе',409);
 if(p.group==='works'){
  if(!Array.isArray(values.works)||values.works.length>50)fail('Не более 50 работ');
  values.works=values.works.map(x=>{if(!object(x))fail('Проверьте строку работы');const name=text(x.name,200);if(!name||!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>100000)fail('Укажите название и целое количество работы');return {name,quantity:x.quantity,price:money(x.price),...(x.catalog_id?{catalog_id:text(x.catalog_id,100)}:{})};});
  const result=h.update({kind:'repair',id:p.id,revision,request_id:p.request_id,step_flow:true,flow_action:'save_works',edit_work_lines:true,warranty_days:r.warranty_days,...values},actor);
  h.event('repair',p.id,'service_edit',actor,{group:p.group,before:{works:r.works},after:values,reason});return result;
 }
 if(p.group==='pricing'){
  if(values.discount!==undefined)values.discount=money(values.discount);
  if(values.total_override!==undefined&&values.total_override!==null)values.total_override=money(values.total_override);
  if(values.approve!==undefined&&typeof values.approve!=='boolean')fail('Проверьте согласование');
  if(values.approval_note!==undefined)values.approval_note=text(values.approval_note,2000);
  const pricing=h.pricing(raw,values,r.works,r.parts);if(pricing.total<r.paid_amount-.005)fail('Стоимость меньше оплаченной суммы. Сначала оформите возврат на кассе',409);
  const result=h.update({kind:'repair',id:p.id,revision,request_id:p.request_id,step_flow:true,flow_action:'save_comment',warranty_days:r.warranty_days,...values},actor);
  h.event('repair',p.id,'service_edit',actor,{group:p.group,before:{discount:r.discount,total_override:r.total_override,approved_amount:r.approved_amount,approval_note:r.approval_note},after:values,reason});return result;
 }
 if(p.group==='parts_return'){
  if(!reason)fail('Укажите причину возврата детали');const index=values.source_index;
  if(!Number.isSafeInteger(index)||!r.parts[index])fail('Выданная деталь изменилась. Обновите карточку',409);
  const kept=r.parts.filter((_,i)=>i!==index),pricing=h.pricing(raw,{},r.works,kept);
  if(pricing.total<r.paid_amount-.005)fail('Сначала скорректируйте оплату на кассе',409);
  h.returnParts(kept,r.parts,raw,{request_id:p.request_id,note:reason},actor);
  h.patch('Ремонты',raw.__row,{'Строки запчастей':JSON.stringify(kept),'Запчасти':kept.reduce((n,x)=>n+x.price*x.quantity,0),'Скидка':pricing.discount,'Итого':pricing.total,'Контроль качества':false,'Статус':h.human(r.status==='ready'?'repair':r.status,'repair'),'Согласовано, ₽':'','Примечание согласования':'',updated_at:h.now(),revision:revision+1});
  h.event('repair',p.id,'repair_steps',actor,{...r.step_state,action:'parts_return',payment_qr:false,completion_request_id:''});
  h.event('repair',p.id,'service_edit',actor,{group:p.group,before:{part:r.parts[index]},after:{returned:true},reason});return h.map(raw);
 }
 const intake=h.rows('Приёмки').find(x=>x.intake_id===raw.intake_id);if(!intake)fail('Приёмка не найдена',404);
 const intakeChanges={},repairChanges={},columns={serial_number:'Серийный номер',accessories:'Комплектность',condition_notes:'Состояние при приёмке',issue_description:'Описание неисправности'};
 if(p.group==='client'){
  for(const k of fields.client)if(values[k]!==undefined)values[k]=text(values[k],k==='email'?254:200);
  const next={...r,...values};if(!next.last_name||!next.first_name||!/^\+7\d{10}$/.test(next.phone))fail('Укажите фамилию, имя и полный телефон');
  if(next.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))fail('Проверьте email');
  const client=h.rows('Клиенты').find(x=>x.client_id===intake.client_id);if(!client)fail('Клиент не найден',404);
  const expected={full_name:String(client['ФИО']||''),phone:String(client['Телефон']||''),email:String(client['Email']||'')};
  if(!object(p.expected)||Object.keys(expected).some(k=>p.expected[k]!==expected[k]))fail('Карточка клиента уже изменена. Откройте свежие данные для сверки',409);
  if(h.rows('Клиенты').some(x=>x.client_id!==client.client_id&&String(x['Телефон'])===next.phone))fail('Этот телефон уже принадлежит другому клиенту. Объединение выполняет администратор',409);
  Object.assign(intakeChanges,{'Клиент':[next.last_name,next.first_name,next.middle_name].filter(Boolean).join(' '),'Телефон':next.phone,Email:next.email});
  h.patch('Клиенты',client.__row,{'ФИО':intakeChanges['Клиент'],'Телефон':next.phone,Email:next.email,updated_at:h.now()});
 }else if(p.group==='vehicle'){
  for(const k of fields.vehicle)if(values[k]!==undefined)values[k]=k==='promised_date'?date(values[k]):text(values[k],['condition_notes','issue_description','accessories'].includes(k)?5000:200);
  const next={...r,...values};if(!next.brand||!next.model)fail('Выберите бренд и модель техники');
  if(values.brand!==undefined||values.model!==undefined)intakeChanges['Бренд / модель']=[next.brand,next.model].join(' ');
  for(const [k,column]of Object.entries(columns))if(values[k]!==undefined)intakeChanges[column]=values[k];
  if(values.promised_date!==undefined){intakeChanges['Плановая дата']=values.promised_date;repairChanges['Плановая дата']=values.promised_date;}
 }else if(p.group==='diagnostics'){
  for(const k of ['diagnostics_notes','note'])if(values[k]!==undefined)values[k]=text(values[k],5000);
  if(values.diagnostics_notes!==undefined)repairChanges['Диагностика']=values.diagnostics_notes;
  if(values.note!==undefined)repairChanges['Примечание']=values.note;
  if(values.promised_date!==undefined){values.promised_date=date(values.promised_date);repairChanges['Плановая дата']=values.promised_date;intakeChanges['Плановая дата']=values.promised_date;}
 }else if(p.group==='handover'){
  if(values.warranty_days!==undefined){if(!Number.isSafeInteger(values.warranty_days)||values.warranty_days<0||values.warranty_days>3650)fail('Гарантия: целое число от 0 до 3650 дней');repairChanges['Гарантия, дней']=values.warranty_days;}
  if(values.handover_notes!==undefined){values.handover_notes=text(values.handover_notes,5000);repairChanges['Примечание']=values.handover_notes;}
 }
 const before=Object.fromEntries(Object.keys(values).map(k=>[k,r[k]??'']));
 if(Object.keys(intakeChanges).length)h.patch('Приёмки',intake.__row,{...intakeChanges,updated_at:h.now()});
 h.patch('Ремонты',raw.__row,{...repairChanges,updated_at:h.now(),revision:revision+1});
 h.event('repair',p.id,'service_edit',actor,{group:p.group,before,after:values,reason});return h.map(raw);
}
function editCustomer(p,actor,h){
 const raw=h.rows('Клиенты').find(x=>x.client_id===p.id);if(!raw)fail('Клиент не найден',404);
 const current={full_name:String(raw['ФИО']||''),phone:String(raw['Телефон']||''),email:String(raw['Email']||'')};
 if(!object(p.expected)||Object.keys(current).some(k=>p.expected[k]!==current[k]))fail('Карточка клиента изменилась. Откройте актуальные данные для сверки',409);
 const values={...current,...p.values};for(const k of Object.keys(current))values[k]=text(values[k],k==='email'?254:300);
 if(!values.full_name||!/^\+7\d{10}$/.test(values.phone))fail('Укажите ФИО и полный телефон');if(values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))fail('Проверьте email');
 if(h.rows('Клиенты').some(x=>x.client_id!==p.id&&String(x['Телефон'])===values.phone))fail('Телефон уже принадлежит другому клиенту',409);
 h.patch('Клиенты',raw.__row,{'ФИО':values.full_name,'Телефон':values.phone,Email:values.email,updated_at:h.now()});
 h.event('client',p.id,'service_edit',actor,{group:'customer',before:current,after:values,reason:text(p.reason||'',500)});
 return {id:p.id,...values};
}
