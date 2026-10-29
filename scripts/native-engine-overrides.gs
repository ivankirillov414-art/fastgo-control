// Native business rules retained independently of the older Google adapter.
function requireManager_(a){ if(!['developer','owner','admin','receiver','manager','mechanic'].includes(role_(a))) throw httpError_('Нет доступа',403); }

function requireOwner_(a){if(!['developer','owner'].includes(role_(a)))throw httpError_('Реквизиты доступны только владельцу',403);}

function requireAdmin_(a){ if(!['developer','owner','admin'].includes(role_(a))) throw httpError_('Нет права изменять справочник',403); }

function mapStaff_(r){ return {profile_id:r.employee_id,name:r['ФИО'],email:r['Email'],role:({'Разработчик':'developer','Владелец':'owner','Администратор':'admin','Мастер-приёмщик':'receiver','Механик':'mechanic','Менеджер':'manager','Кассир':'manager'})[r['Роль']]||r['Роль'],active:r['Активен']!==false,tags:[]}; }

function requireCash_(actor){if(!['developer','owner','seller'].includes(role_(actor))&&actor.can_sell!==true)throw httpError_('Касса доступна продажнику, владельцу и разработчику',403);}

function isManager_(a){ return ['developer','owner','admin','receiver','manager','mechanic'].includes(role_(a)); }

function mapRepair_(r){
  const intake=find_(SHEETS.intakes,'intake_id',r.intake_id)||{};
  const client=find_(SHEETS.clients,'client_id',intake.client_id)||{};
  const n=splitName_(intake['Клиент']);
  const vehicle=String(intake['Бренд / модель']||'').trim().split(/\s+/);
  return {
    id:r.repair_id,repair_number:Number(String(r['Номер ремонта']).replace(/\D/g,''))||r['Номер ремонта'],
    last_name:n.last_name,first_name:n.first_name,middle_name:n.middle_name,phone:intake['Телефон'],email:intake['Email']||client['Email']||'',
    vehicle_type:intake['Тип техники']||'Электротранспорт',brand:vehicle[0]||'',model:vehicle.slice(1).join(' '),serial_number:intake['Серийный номер']||'',
    issue_description:intake['Описание неисправности']||'',accessories:intake['Комплектность']||'',condition_notes:intake['Состояние при приёмке']||'',
    status:normStatus_(r['Статус'],'repair'),paid_amount:num_(r['Оплачено']),created_at:r['Создано'],issued_at:r['Выдано']||'',total_amount:num_(r['Итого']),total_override:repairManualTotal_(r),
    assigned_master:r['Мастер'],assigned_master_id:r.master_id||'',promised_date:r['Плановая дата']||intake['Плановая дата']||'',
    step_state:repairStepState_(r),master_first_name:masterFirstName_(r['Мастер']),parts_status:repairPartsStatus_(r),quality_checked:bool_(r['Контроль качества']),storage_id:r.storage_id||'',diagnostics_notes:r['Диагностика']||'',
    works:parseJson_(r['Работы'],[]),parts:parseJson_(r['Строки запчастей'],[]),discount:num_(r['Скидка']),
    warranty_days:num_(r['Гарантия, дней']),revision:Math.max(1,num_(r.revision)||1),note:r['Примечание']||'',handover_notes:r['Примечание']||'',
    approved_amount:r['Согласовано, ₽']===''||r['Согласовано, ₽']===null?null:num_(r['Согласовано, ₽']),approval_note:r['Примечание согласования']||'',
    scooter_photo_path:'',display_photo_path:'',motor_photo_path:'',fault_photo_paths:orderFiles_(r.repair_id).filter(x=>x.slot==='photos').map(x=>x.url),signed_document_paths:orderFiles_(r.repair_id).filter(x=>x.slot==='signed').map(x=>x.url)
  };
}

function createOrder_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair', requestId=String(p.request_id||'');
  if(requestId){
    const old=kind==='storage'?find_(SHEETS.storage,'request_id',requestId):find_(SHEETS.repairs,'request_id',requestId);
    if(old) return kind==='storage'?mapStorage_(old):mapRepair_(old);
  }
  const intakeSeq=nextSeq_('next_intake_seq'), intakeNo='FGI-'+pad_(intakeSeq,4), orderSeq=nextSeq_(kind==='storage'?'next_storage_seq':'next_repair_seq');
  const orderNo=(kind==='storage'?'FGST-':'FGR-')+pad_(orderSeq,4), id=String(p.desktop_id||uid_());
  if(p.desktop_id&&find_(SHEETS.intakes,'intake_id',id))throw httpError_('Идентификатор приёмки уже занят',409);
  const clientId=ensureClient_(p,intakeNo), client=fullName_(p);
  const folderUrl='', created=now_();
  append_(SHEETS.intakes,{intake_id:id,'Номер':intakeNo,'Создано':created,client_id:clientId,'Клиент':client,'Телефон':String(p.phone||''),'Тип услуги':kind==='storage'?'Зимнее хранение':'Ремонт','Тип техники':String(p.vehicle_type||'Электротранспорт'),'Бренд / модель':[p.brand,p.model].filter(Boolean).join(' '),'Серийный номер':String(p.serial_number||''),'Комплектность':String(p.accessories||''),'Описание неисправности':String(p.issue_description||''),'Состояние при приёмке':String(p.condition_notes||''),'Статус':'Принят','Ответственный':actor.email||actor.id||'','Предварительная стоимость':0,'Предоплата':0,'Итоговая сумма':0,'Статус оплаты':'Не оплачено','Папка фото':folderUrl,'Папка документов':folderUrl,'Плановая дата':String(p.promised_date||p.planned_return_date||''),'Закрыто':'','Примечание':'',updated_at:created,Email:String(p.email||''),request_id:requestId});
  if(kind==='storage'){
    const months=Math.max(1,Math.floor(num_(p.storage_months)||1)), tariff=String(p.storage_tariff||'monthly'), amount=(tariff==='season'?7990:months*1990)+(bool_(p.wash)?500:0);
    append_(SHEETS.storage,{storage_id:id,'Номер':orderNo,intake_id:id,client_id:clientId,'Клиент':client,'Телефон':String(p.phone||''),'Техника':[p.brand,p.model].filter(Boolean).join(' '),'Создано':created,'Дата начала':String(p.starts_on||''),'План возврата':String(p.planned_return_date||''),'Тариф':tariff,'Сумма':amount,'Оплачено':0,'Статус оплаты':'Не оплачено','Мойка +500':bool_(p.wash),'Ячейка / место':String(p.storage_location||''),'Статус':'Принят','Папка фото':folderUrl,'Папка документов':folderUrl,'Выдано':'','Примечание':'',updated_at:created,revision:1,request_id:requestId});
    addEvent_(kind,id,'create',actor,{to_status:'accepted'});
    return mapStorage_(find_(SHEETS.storage,'storage_id',id));
  }
  const masterId=String(p.assigned_master_id||''), staff=masterId?find_(SHEETS.staff,'employee_id',masterId):null, staffView=staff?mapStaff_(staff):null;
  if(masterId&&!(p.step_flow===true&&p.assigned_master_id===undefined)&&(!staffView||!staffView.active||staffView.role!=='mechanic'))throw httpError_('Назначить можно только активного мастера',400);
  append_(SHEETS.repairs,{repair_id:id,'Номер ремонта':orderNo,intake_id:id,'Создано':created,'Статус':'Принят','Мастер':staff?staff['ФИО']:'','Диагностика':'','Работы':'[]','Стоимость работ':0,'Запчасти':0,'Скидка':0,'Итого':0,'Гарантия, дней':0,'Начато':'','Завершено':'','Выдано':'','Примечание':'',updated_at:created,'Строки запчастей':'[]','Оплачено':0,master_id:masterId,'Контроль качества':false,'Плановая дата':String(p.promised_date||''),storage_id:String(p.storage_id||''),revision:1,request_id:requestId,'Согласовано, ₽':'','Примечание согласования':''});
  addEvent_(kind,id,'create',actor,{to_status:'accepted'});
  return mapRepair_(find_(SHEETS.repairs,'repair_id',id));
}

function updateOrder_(p,actor){
  validateOrderUpdate_(p,actor);
  const kind=p.kind==='storage'?'storage':'repair';
  if(kind==='storage'){
    const r=find_(SHEETS.storage,'storage_id',p.id); if(!r) throw httpError_('Хранение не найдено',404);
    requireOrderAccess_(actor,kind,r); const rev=assertRevision_(r,p);
    const fromStatus=normStatus_(r['Статус'],'storage'), toStatus=String(p.status||fromStatus);
    patchRow_(SHEETS.storage,r.__row,{'Статус':humanStatus_(toStatus,'storage'),'Ячейка / место':p.storage_location===undefined?r['Ячейка / место']:p.storage_location,'План возврата':p.planned_return_date===undefined?r['План возврата']:p.planned_return_date,'Примечание':p.handover_notes===undefined?r['Примечание']:p.handover_notes,'Выдано':toStatus==='returned'?now_():r['Выдано'],updated_at:now_(),revision:rev+1});
    addEvent_(kind,p.id,'update',actor,{from_status:fromStatus,to_status:toStatus,note:String(p.reopen_reason||p.handover_notes||'')});
    return mapStorage_(find_(SHEETS.storage,'storage_id',p.id));
  }
  const r=find_(SHEETS.repairs,'repair_id',p.id); if(!r) throw httpError_('Ремонт не найден',404);
  requireOrderAccess_(actor,kind,r); const rev=assertRevision_(r,p);
  const partsChoiceBefore=repairPartsStatus_(r),previousMaster=String(r.master_id||'');
  const works=Array.isArray(p.works)?p.works:parseJson_(r['Работы'],[]), parts=Array.isArray(p.parts)?JSON.parse(JSON.stringify(p.parts)):parseJson_(r['Строки запчастей'],[]), oldParts=parseJson_(r['Строки запчастей'],[]);
  if(role_(actor)==='mechanic'&&(parts.length!==oldParts.length||!repairPartsSubset_(parts,oldParts)))throw httpError_('Выданные детали изменяются на кассе',403);
  if(parts.length!==oldParts.length)returnRepairParts_(parts,oldParts,r,p,actor);
  const worksTotal=works.reduce((sum,x)=>sum+Math.max(1,num_(x.quantity)||1)*num_(x.price),0), partsTotal=parts.reduce((sum,x)=>sum+Math.max(1,num_(x.quantity)||1)*num_(x.price),0), pricing=repairPricing_(r,p,works,parts),total=pricing.total,previousTotal=num_(r['Итого']);
  const masterId=p.assigned_master_id===undefined?String(r.master_id||''):String(p.assigned_master_id||''), staff=masterId?find_(SHEETS.staff,'employee_id',masterId):null, staffView=staff?mapStaff_(staff):null, status=String(p.status||normStatus_(r['Статус'],'repair'));
  if(masterId&&!(p.step_flow===true&&p.assigned_master_id===undefined)&&(!staffView||!staffView.active||staffView.role!=='mechanic'))throw httpError_('Назначить можно только активного мастера',400);
  const fromStatus=normStatus_(r['Статус'],'repair'), sameTotal=Math.abs(num_(r['Итого'])-total)<.005, approvalAmount=bool_(p.approve)?total:(sameTotal?r['Согласовано, ₽']:''), approvalNote=bool_(p.approve)?String(p.approval_note||''):(sameTotal?r['Примечание согласования']:'');
  patchRow_(SHEETS.repairs,r.__row,{'Статус':humanStatus_(status,'repair'),'Мастер':staff?staff['ФИО']:String(p.assigned_master||r['Мастер']||''),'Диагностика':p.diagnostics_notes===undefined?r['Диагностика']:String(p.diagnostics_notes||''),'Работы':JSON.stringify(works),'Стоимость работ':worksTotal,'Запчасти':partsTotal,'Скидка':pricing.discount,'Итого':total,'Гарантия, дней':num_(p.warranty_days),'Начато':!r['Начато']&&['diagnostics','repair','waiting_parts'].includes(status)?now_():r['Начато'],'Завершено':status==='ready'?now_():r['Завершено'],'Выдано':status==='issued'?now_():r['Выдано'],'Примечание':status==='issued'?String(p.handover_notes||r['Примечание']||''):status==='cancelled'?String(p.note||r['Примечание']||''):(p.note===undefined?r['Примечание']:String(p.note||'')),updated_at:now_(),'Строки запчастей':JSON.stringify(parts),master_id:masterId,'Контроль качества':['diagnostics','waiting_parts','repair'].includes(status)?false:(p.quality_checked===undefined?bool_(r['Контроль качества']):bool_(p.quality_checked)),'Плановая дата':p.promised_date===undefined?r['Плановая дата']:String(p.promised_date||''),revision:rev+1,'Согласовано, ₽':approvalAmount,'Примечание согласования':approvalNote});
  recordRepairPartsChoice_(r,p,actor,partsChoiceBefore,previousMaster);
  if(p.step_flow===true){const prior=repairStepState_(r),masterName=String(actor.name||actor.email||'Сотрудник');addEvent_('repair',p.id,'repair_steps',actor,{...prior,mode:'steps',action:p.flow_action,...(p.waiting_part!==undefined?{waiting_part:p.waiting_part,waiting_due:p.waiting_due}:{}),...(p.master_comment!==undefined?{master_comment:p.master_comment.trim()}:{}),...(p.flow_action==='complete'?{completion_request_id:p.request_id,completion_at:now_(),completion_master_name:masterFirstName_(masterName),payment_qr:p.payment_qr===true}:{})});}

  if(p.total_override!==undefined&&p.total_override!==repairManualTotal_(r))addEvent_(kind,p.id,'price',actor,{total_override:p.total_override,total,previous_total:previousTotal});
  addEvent_(kind,p.id,'update',actor,{from_status:fromStatus,to_status:status,note:String(p.reopen_reason||p.handover_notes||p.note||'')});
  return mapRepair_(find_(SHEETS.repairs,'repair_id',p.id));
}

function finishStorage_(p,actor,deleting){
 if(!['developer','owner','receiver','manager','mechanic'].includes(role_(actor)))throw httpError_('Действие доступно владельцу или мастеру-приёмщику',403);
 if(p.kind!=='storage')throw httpError_('Выберите хранение',400);
 const r=find_(SHEETS.storage,'storage_id',p.id);
 if(!r)throw httpError_('Хранение не найдено',404);
 if(p.revision===undefined||!Number.isInteger(Number(p.revision)))throw httpError_('Нужна версия карточки',400);
 const rev=assertRevision_(r,p),before=normStatus_(r['Статус'],'storage'),note=String(p.note||'').trim();
 if(before==='deleted')throw httpError_('Приёмка уже удалена',409);
 if(!note)throw httpError_('Укажите причину или отметку о выдаче',400);
 const linked=rows_(SHEETS.repairs).filter(x=>x.storage_id===p.id);
 if(!deleting&&(num_(r['Оплачено'])<num_(r['Сумма'])||linked.some(x=>!['issued','cancelled'].includes(normStatus_(x['Статус'],'repair')))))throw httpError_('Сначала оплатите хранение и завершите связанные ремонты',409);
 if(!deleting&&['returned','cancelled'].includes(before))throw httpError_('Хранение уже закрыто',409);
 const status=deleting?'deleted':'returned',stamp=now_();
 patchRow_(SHEETS.storage,r.__row,{'Статус':deleting?'deleted':humanStatus_(status,'storage'),'Выдано':deleting?r['Выдано']:stamp,'Примечание':note,updated_at:stamp,revision:rev+1});
 addEvent_('storage',p.id,deleting?'storage_delete':'storage_close',actor,{number:r['Номер'],from_status:before,to_status:status,note:note,actor_name:actor.name||actor.email||actor.id});
 return {id:p.id,status:status,revision:rev+1};
}

function validateOrderUpdate_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair',r=find_(kind==='storage'?SHEETS.storage:SHEETS.repairs,kind==='storage'?'storage_id':'repair_id',p.id);
  if(!r)throw httpError_('Заказ не найден',404);requireOrderAccess_(actor,kind,r);assertRevision_(r,p);
  if(kind==='repair'&&p.step_flow===true)prepareRepairStep_(r,p,actor);
  const before=normStatus_(r['Статус'],kind),status=p.status||before,closed=['issued','returned','cancelled'];
  const authorizedReopen=closed.includes(before)&&['developer','owner','admin'].includes(role_(actor))&&!!String(p.reopen_reason||'').trim()&&status===(kind==='storage'?'stored':'accepted');
  if(closed.includes(before)&&!authorizedReopen)throw httpError_('Закрытый заказ может открыть администратор с причиной',409);
  if(String(p.reopen_reason||'').trim()&&!authorizedReopen)throw httpError_('Повторно открыть можно только закрытый заказ с причиной',409);
  if(kind==='storage'){
    if(before==='deleted')throw httpError_('Приёмка удалена',409);
    if(status==='returned'&&status!==before&&!['developer','owner','receiver','manager','mechanic'].includes(role_(actor)))throw httpError_('Закрыть хранение может владелец или мастер-приёмщик',403);
    if(!['accepted','stored','ready_return','returned','cancelled'].includes(status))throw httpError_('Неверный статус',400);
    if(status==='returned'&&(before!=='ready_return'||num_(r['Оплачено'])<num_(r['Сумма'])||rows_(SHEETS.repairs).some(x=>x.storage_id===p.id&&!closed.includes(normStatus_(x['Статус'],'repair')))))throw httpError_('Для выдачи нужны готовность, полная оплата и завершённые ремонты',409);
    return;
  }
  if(!REPAIR_TRANSITIONS_[status])throw httpError_('Неверный статус',400);
  if(!authorizedReopen)requireRepairTransition_(before,status);
  if(status!==before&&['ready','issued','cancelled'].includes(status)&&!canSetRepairStatus_(actor,status))throw httpError_('У вашей роли нет права на этот статус ремонта',403);
  const masterId=p.assigned_master_id===undefined?String(r.master_id||''):String(p.assigned_master_id||'');
  const diagnostics=p.diagnostics_notes===undefined?String(r['Диагностика']||''):String(p.diagnostics_notes||'');
  if(p.step_flow!==true&&['waiting_parts','repair','ready','issued'].includes(status)&&!diagnostics.trim())throw httpError_('Сначала заполните результат диагностики',409);
  const works=p.works||parseJson_(r['Работы'],[]),parts=p.parts||parseJson_(r['Строки запчастей'],[]);
  requireRepairParts_(r,p,actor);
  for(const line of [...works,...parts])if(!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1||!Number.isFinite(Number(line.price))||Number(line.price)<0)throw httpError_('Проверьте количество и цену',400);
  const pricing=repairPricing_(r,p,works,parts),discount=pricing.discount,amount=pricing.total;
  if(p.total_override!==undefined&&!isManager_(actor))throw httpError_('Нет права изменять стоимость ремонта',403);
  if(amount<0||discount<0)throw httpError_('Неверная скидка',400);
  if(!isManager_(actor)&&(p.approve||discount!==num_(r['Скидка'])))throw httpError_('Нет права согласования или скидки',403);
  if(p.approve&&!String(p.approval_note||'').trim())throw httpError_('Укажите согласование',400);
  const sameTotal=Math.abs(num_(r['Итого'])-amount)<.005,approved=p.approve?amount:(sameTotal?r['Согласовано, ₽']:null),quality=p.quality_checked===undefined?bool_(r['Контроль качества']):bool_(p.quality_checked);
  if(p.step_flow!==true&&['repair','ready','issued'].includes(status)&&amount>0&&(approved===''||approved===null||Math.abs(num_(approved)-amount)>=.005))throw httpError_('Сначала согласуйте текущую стоимость с клиентом',409);
  if(['ready','issued'].includes(status)&&!quality)throw httpError_('Перед статусом «Готов» выполните контроль качества',409);
  if(status==='issued'&&(before!=='ready'||num_(r['Оплачено'])<amount))throw httpError_('Для выдачи нужны готовность и полная оплата',409);
  if(status==='cancelled'&&status!==before&&(num_(r['Оплачено'])!==0||parts.length>0||!String(p.note||'').trim()))throw httpError_('Перед отменой верните оплату, снимите установленные запчасти и укажите причину',409);
}

function canSetRepairStatus_(actor,status){
  if(['developer','owner'].includes(role_(actor)))return true;
  if(['receiver','manager','mechanic'].includes(role_(actor)))return true;
  const p=actor?.status_permissions||{};
  if(status==='ready')return p.can_mark_ready===true;
  if(status==='issued')return p.can_issue===true;
  if(status==='cancelled')return p.can_cancel===true;
  return true;
}

const REPAIR_TRANSITIONS_={
  accepted:new Set(['accepted','diagnostics','cancelled']),
  diagnostics:new Set(['diagnostics','waiting_parts','repair','cancelled']),
  waiting_parts:new Set(['waiting_parts','diagnostics','repair','cancelled']),
  repair:new Set(['repair','diagnostics','waiting_parts','ready','cancelled']),
  ready:new Set(['ready','repair','issued','cancelled']),
  issued:new Set(['issued']),
  cancelled:new Set(['cancelled'])
};

function requireRepairTransition_(from,to){if(!REPAIR_TRANSITIONS_[from]?.has(to))throw httpError_('Сначала пройдите предыдущий этап ремонта',409);}


function sale_(p,actor){
  const req=String(p.request_id||''); if(req){ const old=find_(SHEETS.sales,'request_id',req); if(old) return saleResponse_(old); }
  if(p.service_items!==undefined)return serviceSale_(p,actor);
  requireCash_(actor);const shift=cashShifts_().find(s=>s.id===p.shift_id);if(!shift||shift.status!=='open')throw httpError_('Откройте кассовую смену перед продажей',409);
  const merged={};for(const x of (Array.isArray(p.items)?p.items:[])){const id=x.part_id||x.id,q=Number(x.quantity);if(!id||!Number.isInteger(q)||q<1)throw httpError_('Неверное количество',400);const old=merged[id];if(old&&(old.price_mode!==x.price_mode||old.unit_price!==x.unit_price))throw httpError_('У товара разные цены в корзине',400);merged[id]={part_id:id,quantity:(old?.quantity||0)+q,price_mode:x.price_mode,unit_price:x.unit_price};}
  const items=Object.values(merged);if(!items.length)throw httpError_('Корзина пустая',400);
  if(!['cash','card','transfer'].includes(p.payment_method))throw httpError_('Укажите оплату',400);if(num_(p.discount)>0)requireAdmin_(actor);
  const prepared=items.map(i=>{ const r=find_(SHEETS.products,'product_id',i.part_id||i.id); if(!r||r['Активен']===false) throw httpError_('Товар не найден',404); if(typeof i.quantity==='boolean'||!Number.isSafeInteger(Number(i.quantity))||Number(i.quantity)<1)throw httpError_('Неверное количество',400); const q=Number(i.quantity); const stock=num_(r['Остаток, шт.']); if(isEquipmentProduct_(r)&&stock<q) throw httpError_('Недостаточно на складе: '+r['Модель / название'],409); if(i.price_mode!==undefined&&!['base','free'].includes(i.price_mode))throw httpError_('Неверный режим цены',400); let price=num_(r['Цена продажи, ₽']); if(i.price_mode==='free'){price=Number(i.unit_price);if(i.unit_price===null||i.unit_price===''||typeof i.unit_price==='boolean'||!Number.isFinite(price)||price<0||price>1e9||Math.abs(price*100-Math.round(price*100))>0.0001)throw httpError_('Проверьте свободную цену',400);price=Math.round(price*100)/100;} return {r,q,price}; });
  const manual=p.total_override;if(manual!==undefined&&(typeof manual!=='number'||!Number.isFinite(manual)||manual<0||manual>1e8||Math.abs(manual*100-Math.round(manual*100))>0.00001))throw httpError_('Проверьте итоговую сумму',400);
  const no=nextSeq_('next_sale_seq'), id=uid_(), created=now_(), subtotal=prepared.reduce((s,x)=>s+x.q*x.price,0), discount=manual===undefined?Math.max(0,num_(p.discount)):Math.max(0,Math.round((subtotal-manual)*100)/100), total=manual===undefined?Math.round(Math.max(0,subtotal-discount)*100)/100:manual;
  if(manual!==undefined)p={...p,note:[p.note,'Итого вручную: '+subtotal+' → '+manual+' ₽'].filter(Boolean).join(' · ')};
  const sale={sale_id:id,'Номер':'FGS-'+pad_(no,6),'Дата':created,client_id:String(p.client_id||''),'Клиент':String(p.client_name||''),'Сотрудник':actor.email||actor.id||'','Способ оплаты':({'cash':'Наличные','card':'Карта','transfer':'Перевод','mixed':'Смешанная'})[p.payment_method]||p.payment_method||'Наличные','Сумма':subtotal,'Скидка':discount,'Итого':total,'Статус':'Проведена','Комментарий':String(p.note||''),updated_at:created,request_id:req,'Документ URL':''}; append_(SHEETS.sales,sale);
  prepared.forEach((x,idx)=>{ const stock=num_(x.r['Остаток, шт.'])-x.q; patchRow_(SHEETS.products,x.r.__row,{'Остаток, шт.':stock,updated_at:created}); const movementId=uid_(); append_(SHEETS.movements,{movement_id:movementId,'Дата':created,'Тип':'Продажа',product_id:x.r.product_id,'Штрих-код':x.r['Штрих-код'],'Товар':x.r['Модель / название'],'Количество':x.q,'Цена закупки':num_(x.r['Цена закупки, ₽']),'Цена продажи':x.price,'Сумма':x.q*x.price,'Источник':'Продажа',reference_id:id,'Сотрудник':actor.email||actor.id||'','Комментарий':'Продажа '+sale['Номер'],'Остаток после':stock,request_id:req?req+':'+idx:''}); append_(SHEETS.saleItems,{sale_item_id:uid_(),sale_id:id,product_id:x.r.product_id,'Штрих-код':x.r['Штрих-код'],'Товар':x.r['Модель / название'],'Количество':x.q,'Цена':x.price,'Скидка':0,'Сумма строки':x.q*x.price,movement_id:movementId}); });
  addEvent_('cash',id,'sale',actor,{shift_id:shift.id,register:shift.register});
  return saleResponse_(find_(SHEETS.sales,'sale_id',id));
}

function repairPricing_(r,p,works,parts){
 const gross=Math.round([...works,...parts].reduce((sum,x)=>sum+Number(x.price||0)*Number(x.quantity||1),0)*100)/100;
 const manual=p.total_override===undefined?repairManualTotal_(r):p.total_override;
 if(manual!==null&&(typeof manual!=='number'||!Number.isFinite(manual)||manual<0||manual>1e8||Math.abs(manual*100-Math.round(manual*100))>.00001))throw httpError_('Проверьте итоговую стоимость ремонта',400);
 const discount=manual===null?num_(p.discount===undefined?r['Скидка']:p.discount):Math.max(0,Math.round((gross-manual)*100)/100);
 const total=manual===null?Math.round((gross-discount)*100)/100:manual;
 if(total<num_(r['Оплачено']))throw httpError_('Стоимость меньше уже внесённой оплаты. Сначала оформите возврат',409);
 return {total,discount,override:manual};
}

// The same atomic audit ledger mirrors to Google without adding spreadsheet
// columns or requiring a change to installed replication workers.
function repairManualTotal_(repair){
 let found=null,row=-1;
 for(const event of rows_(SHEETS.events)){
  if(event['Тип']!=='repair'||event.record_id!==repair.repair_id||!['price','payment'].includes(event['Действие']))continue;
  let detail;try{detail=JSON.parse(String(event['Детали']||'{}'));}catch{continue;}if(!detail||!Object.prototype.hasOwnProperty.call(detail,'total_override'))continue;
  const order=Number(event.__row)||0;if(order>=row){row=order;found=detail.total_override===null?null:Number(detail.total_override);}
 }
 return found;
}

function returnRepairParts_(parts,oldParts,repair,p,actor){
 const kept=parts.filter(x=>x.tsd_issue_id).map(x=>JSON.stringify(x));
 for(const line of oldParts.filter(x=>x.tsd_issue_id)){
  const index=kept.indexOf(JSON.stringify(line));if(index>=0){kept.splice(index,1);continue;}
  stock_({part_id:line.part_id,movement_type:'return',quantity:line.quantity,note:'Возврат выдачи ТСД из ремонта '+repair['Номер ремонта'],reference_id:repair.repair_id},actor);
 }
 const legacy=parts.filter(x=>!x.tsd_issue_id),oldLegacy=oldParts.filter(x=>!x.tsd_issue_id);
 if(legacy.length!==oldLegacy.length)reconcileMasterParts_(legacy,oldLegacy,repair,p,actor);
}


function masterFirstName_(name){const words=String(name||'').trim().split(/\s+/).filter(Boolean),family=w=>/(?:ов|ев|ин|ский|цкий|ова|ева|ина|ская|цкая|ко)$/i.test(w||'');if(words.length>=3&&/(?:вич|вна|ична)$/i.test(words[words.length-1]))return words[1];if(words.length===2&&family(words[0])&&!family(words[1]))return words[1];return words[0]||'';}


function repairStepState_(repair){
 let state={};for(const event of rows_(SHEETS.events).filter(e=>e['Тип']==='repair'&&e.record_id===repair.repair_id&&e['Действие']==='repair_steps').sort((a,b)=>Number(a.__row)-Number(b.__row))){try{const detail=JSON.parse(String(event['Детали']||'{}'));if(detail&&typeof detail==='object'&&!Array.isArray(detail))state={...state,...detail};}catch{};}return state;
}


function prepareRepairStep_(r,p,actor){
 const current=normStatus_(r['Статус'],'repair'),action=p.flow_action;
 if(!['diagnose','save_works','wait_parts','save_comment','complete','handover'].includes(action))throw httpError_('Неизвестное действие ремонта',400);
 if(role_(actor)==='mechanic'&&p.assigned_master_id&&p.assigned_master_id!==actor.id)throw httpError_('Мастер может назначить ремонт только себе',403);
 if(role_(actor)==='mechanic'&&!r.master_id)p.assigned_master_id=actor.id;
 const works=p.works===undefined?parseJson_(r['Работы'],[]):p.works;
 if(!Array.isArray(works))throw httpError_('Выберите работы из прайса',400);
 const existing=parseJson_(r['Работы'],[]);
 for(const line of works){if(!Number.isFinite(Number(line.price))||Number(line.price)<0||Number(line.price)>1e8||Math.abs(Number(line.price)*100-Math.round(Number(line.price)*100))>.00001)throw httpError_('Цена работы: от 0 до 100 000 000 ₽, до двух знаков после запятой',400);const service=rows_(SHEETS.services).find(x=>x.service_id===line.catalog_id&&x['Активна']!==false);if(service){if(line.name!==service['Работа']&&!existing.some(x=>x.catalog_id===line.catalog_id&&x.name===line.name))throw httpError_('Название работы не совпадает с прайсом',400);}else if(!existing.some(x=>x.name===line.name&&(!x.catalog_id||x.catalog_id===line.catalog_id)))throw httpError_('Выберите работу из списка',400);}
 if(['ready','issued','cancelled'].includes(current)&&action!=='handover')throw httpError_('Ремонт завершён; изменение работ требует повторного открытия',409);
 if(p.master_comment!==undefined&&(typeof p.master_comment!=='string'||p.master_comment.length>2000))throw httpError_('Комментарий: до 2000 символов',400);
 p.status=current;
 if(action==='diagnose'){if(current!=='accepted')throw httpError_('Диагностика уже начата',409);p.status='diagnostics';}
 if(action==='save_works'){if(current==='accepted')throw httpError_('Сначала начните диагностику',409);if(works.length&&current!=='waiting_parts')p.status='repair';}
 if(action==='wait_parts'){
  if(!['diagnostics','repair','waiting_parts'].includes(current))throw httpError_('Сначала начните диагностику',409);
  const text=String(p.waiting_part||'').trim(),due=String(p.waiting_due||'');
  if(!text||text.length>300||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)throw httpError_('Укажите ожидаемую запчасть и предполагаемую дату доставки',400);
  p.waiting_part=text;p.waiting_due=due;p.status='waiting_parts';
 }

 if(action==='complete'){
  if(current!=='repair'||!works.length)throw httpError_('Добавьте выполненные работы и завершите ожидание деталей',409);

  if(p.quality_checked!==true)throw httpError_('Подтвердите проверку работы техники',409);
  p.status='ready';
 }
 if(action==='handover'&&(JSON.stringify(works)!==JSON.stringify(parseJson_(r['Работы'],[]))||p.master_comment!==undefined&&p.master_comment!==(repairStepState_(r).master_comment||'')))throw httpError_('Выполненные работы зафиксированы в акте; сначала откройте ремонт повторно',409);
 if(action==='handover'){if(role_(actor)==='mechanic')throw httpError_('Оплата и выдача клиенту выполняются на кассе',403);p.status='issued';}
}
