import {createNativeEngine} from '../_shared/native-engine.js';
import {fail,id} from './model.js';

const method=value=>({cash:'cash',card:'card',transfer:'transfer','Наличные':'cash','Карта':'card','Банковская карта':'card','Безналичные':'card','Безналичный расчёт':'card','Перевод':'transfer'})[value];
const human={cash:'Наличные',card:'Карта',transfer:'Перевод'};
const rows=(sheets,name)=>sheets[name]?.rows||[];
const parse=value=>{try{return JSON.parse(value||'{}');}catch{fail('Не удалось прочитать историю исправления оплаты',503);}};
const cents=(value,positive=false)=>{const n=Number(value);if(value===null||value===''||typeof value==='boolean'||!Number.isFinite(n)||Math.abs(n)>1e9||Math.abs(n*100-Math.round(n*100))>.00001||positive&&n<=0)fail('Проверьте сумму оплаты');return Math.round(n*100);};
const operationId=value=>{const [kind,uuid,...rest]=String(value||'').split(':');if(rest.length||!['sale','payment'].includes(kind)||!id(uuid))fail('Неверная оплата');return {kind,id:uuid};};
export const canCorrectPayments=actor=>['owner','developer'].includes(actor.role)||actor.role==='admin'&&actor.can_sell===true;

export function correctionIndex(sheets){
 const index=new Map();
 for(const event of rows(sheets,'События').filter(e=>e['Тип']==='cash_correction'&&e['Действие']==='payment_correction').sort((a,b)=>Number(a.__row)-Number(b.__row))){
  const detail=parse(event['Детали']);
  if(!['void','edit'].includes(detail.mode)||!Array.isArray(detail.original_ids)||!Array.isArray(detail.reversal_ids)||!Array.isArray(detail.replacement_ids))fail('Повреждена история исправления оплаты',503);
  const common={reason:detail.reason,changed_at:event['Дата'],changed_by:detail.actor_name||event.actor_id,origin:detail.origin};
  for(const key of detail.original_ids)index.set(key,{...common,state:detail.mode==='void'?'cancelled':'edited'});
  for(const key of detail.reversal_ids)index.set(key,{...common,state:'reversal'});
  for(const key of detail.replacement_ids)index.set(key,{...common,state:'active',replacement:true});
 }
 return index;
}

export function annotatePayment(item,index){
 const change=index.get(item.id),state=change?.state||(item.amount<0?'reversal':'active');
 return {...item,operation:{...change,id:item.id,state,can_correct:state==='active'&&item.amount>0&&(!item.payment_kind||['repair','storage','service'].includes(item.payment_kind)),expected_amount:item.amount,expected_method:item.method}};
}

function sourceOperation(sheets,key,index=correctionIndex(sheets)){
 const parsed=operationId(key);let payment=parsed.kind==='payment'?rows(sheets,'Оплаты').find(r=>r.payment_id===parsed.id):null;
 let sale=parsed.kind==='sale'?rows(sheets,'Продажи').find(r=>r.sale_id===parsed.id):payment?.['Тип']==='service'?rows(sheets,'Продажи').find(r=>r.sale_id===payment.record_id):null;
 // Manual work payments appear in both books. They are one payment, regardless
 // of whether a caller selected the sale or its linked payment journal row.
 if(sale&&!payment)payment=rows(sheets,'Оплаты').find(r=>r['Тип']==='service'&&r.record_id===sale.sale_id&&Number(r['Сумма'])>0)||null;
 if(!payment&&!sale)fail('Оплата не найдена',404);
 const canonical=payment?'payment:'+payment.payment_id:'sale:'+sale.sale_id,aliases=[canonical,...(payment&&sale?['sale:'+sale.sale_id]:[])];
 const amount=cents(payment?payment['Сумма']:sale['Итого'],true),m=method(payment?payment['Способ оплаты']:sale['Способ оплаты']);if(!m)fail('Неизвестный способ оплаты',503);
 const state=index.get(canonical)?.state||index.get(key)?.state;
 if(state&&state!=='active'||sale&&['Отменена','Отменено','Исправлена','Сторно','cancelled'].includes(sale['Статус']))fail('Эта оплата уже отменена или исправлена. Обновите отчёт.',409);
 if(payment&&!['repair','storage','service'].includes(payment['Тип']))fail('Этот вид оплаты пока не поддерживает исправление',409);
 if(payment?.['Тип']==='service'&&!sale)fail('Не найдена связанная оплата работ',409);
 if(payment&&sale&&(cents(sale['Итого'])!==amount||method(sale['Способ оплаты'])!==m))fail('Связанные документы оплаты расходятся. Обновите отчёт.',409);
 const items=sale?rows(sheets,'Строки продаж').filter(r=>r.sale_id===sale.sale_id):[];
 const cashEvent=sale?rows(sheets,'События').find(e=>e['Тип']==='cash'&&e['Действие']==='sale'&&e.record_id===sale.sale_id):null;
 const shiftId=cashEvent?parse(cashEvent['Детали']).shift_id||null:null;
 return {key:canonical,aliases,payment,sale,items,amount,method:m,shiftId,origin:index.get(canonical)?.origin||canonical};
}

export function paymentCorrectionPreview(snapshot,p,actor,{stationName=''}={}){
 if(!canCorrectPayments(actor))fail('Исправление оплат доступно владельцу или администратору кассы',403);
 const o=sourceOperation(snapshot.sheets,p.operation_id),state=createNativeEngine(snapshot.sheets).run('cash_state',{},actor),open=state.shifts.filter(s=>s.status==='open'),original=state.shifts.find(s=>s.id===o.shiftId),originalOpen=original?.status==='open';
 return {operation_id:o.key,amount:o.amount/100,method:o.method,expected_amount:o.amount/100,expected_method:o.method,kind:o.payment?.['Тип']||'sale',title:o.sale?'Продажа '+o.sale['Номер']:o.payment['Тип']==='repair'?'Оплата ремонта':'Оплата хранения',created_at:o.payment?.['Дата']||o.sale?.['Дата'],note:o.payment?.['Комментарий']||o.sale?.['Комментарий']||'',stock_return:o.items.some(x=>x.product_id),items:o.items.map(x=>({name:x['Товар'],quantity:Number(x['Количество'])})),original_shift_id:o.shiftId,original_shift_open:originalOpen,original_shift_closed:!!o.shiftId&&!originalOpen,default_shift_id:originalOpen?o.shiftId:null};
}

function writer(snapshot){
 const sheets=structuredClone(snapshot.sheets),changes=new Map();
 const patch=(name,row,values)=>{const sheet=sheets[name],target=sheet?.rows.find(r=>r.__row===row);if(!target)fail('Документ изменился',409);for(const key of Object.keys(values))if(!sheet.headers.includes(key))fail('Рабочая схема не поддерживает исправление оплаты',503);Object.assign(target,values);const key=name+':'+row,prior=changes.get(key);changes.set(key,{sheet:name,row,values:{...prior?.values,...values}});return target;};
 const append=(name,values)=>{const sheet=sheets[name];if(!sheet)fail('Не найден рабочий журнал',503);const row=Math.max(1,...sheet.rows.map(r=>r.__row))+1;sheet.rows.push({...Object.fromEntries(sheet.headers.map(key=>[key,''])),__row:row});return patch(name,row,values);};
 const sequence=()=>{const setting=rows(sheets,'Настройки').find(r=>r['Ключ']==='next_sale_seq'),n=Number(setting?.['Значение']||1);if(!Number.isSafeInteger(n)||n<1)fail('Не удалось получить номер исправления',503);if(setting)patch('Настройки',setting.__row,{'Значение':n+1});else append('Настройки',{'Ключ':'next_sale_seq','Значение':n+1});return 'FGS-'+String(n).padStart(6,'0');};
 return {sheets,patch,append,sequence,changes:()=>[...changes.values()]};
}

export function preparePaymentCorrection(snapshot,p,actor,{uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString(),stationName=''}={}){
 if(!canCorrectPayments(actor))fail('Исправление оплат доступно владельцу или администратору кассы',403);
 if(!id(p.request_id)||!['void','edit'].includes(p.mode)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>500)fail('Укажите причину исправления оплаты');
 const o=sourceOperation(snapshot.sheets,p.operation_id);
 if(typeof p.expected_amount!=='number'||cents(p.expected_amount)!==o.amount||p.expected_method!==o.method)fail('Оплата изменилась. Обновите отчёт.',409);
 const nextAmount=p.mode==='edit'?cents(p.amount,true):0,nextMethod=p.mode==='edit'?method(p.method):o.method;
 if(nextAmount>10000000000)fail('Сумма оплаты не должна превышать 100 000 000 ₽');
 if(!nextMethod||p.mode==='edit'&&typeof p.amount!=='number')fail('Проверьте сумму и способ оплаты');
 if(p.mode==='edit'&&nextAmount===o.amount&&nextMethod===o.method)fail('Измените сумму или способ оплаты');
 if(p.mode==='void'&&o.items.some(x=>x.product_id)&&p.goods_returned!==true)fail('Подтвердите, что товары не были выданы или возвращены на склад');
 const preview=paymentCorrectionPreview(snapshot,p,actor,{stationName});
 let shiftId=null;
 // Correct the original open shift. A retrospective bookkeeping correction is
 // outside the till: neither a closed snapshot nor a later opening cash count
 // is rewritten, and no physical cash refund is inferred from an edit.
 if(o.shiftId&&preview.original_shift_open){shiftId=o.shiftId;if(p.shift_id&&p.shift_id!==o.shiftId)fail('Исправление относится к исходной открытой смене',409);}
 const w=writer(snapshot),at=now(),reason=p.reason.trim(),actorName=actor.name||actor.email||actor.id;
 const label=p.mode==='void'?'Отмена ошибочной оплаты':'Исправление оплаты',reference=o.sale?.['Номер']||o.key;
 const note=label+' '+reference+' · '+reason;
 const event=(kind,record,action,details)=>w.append('События',{event_id:uuid(),'Дата':at,'Тип':kind,record_id:record,'Действие':action,actor_id:actor.id,'Детали':JSON.stringify(details),updated_at:at});
 const reversalIds=[],replacementIds=[];let reversalSale=null,replacementSale=null,repairCompleted=false,repairId=null,paidAfter=null,recordStatus=null;

 if(o.sale){
  reversalSale=uuid();
  const base={...o.sale};delete base.__row;
  w.append('Продажи',{...base,sale_id:reversalSale,'Номер':w.sequence(),'Дата':at,'Сумма':-Number(o.sale['Сумма']||0),'Скидка':-Number(o.sale['Скидка']||0),'Итого':-o.amount/100,'Статус':'Сторно','Комментарий':note,'Документ URL':'',request_id:p.request_id,updated_at:at});reversalIds.push('sale:'+reversalSale);
  if(p.mode==='edit'){
   replacementSale=uuid();w.append('Продажи',{...base,sale_id:replacementSale,'Номер':w.sequence(),'Дата':at,'Способ оплаты':human[nextMethod],'Скидка':Math.max(0,Math.round((Number(o.sale['Сумма']||0)-nextAmount/100)*100)/100),'Итого':nextAmount/100,'Статус':'Проведена','Комментарий':note,'Документ URL':'',request_id:p.request_id,updated_at:at});replacementIds.push('sale:'+replacementSale);
  }
  for(const line of o.items){
   const q=Number(line['Количество']);if(!Number.isSafeInteger(q)||q<=0)fail('Повреждены позиции исходной продажи',503);
   const copy={...line};delete copy.__row;let movement='';
   if(p.mode==='void'&&line.product_id){
    const product=rows(w.sheets,'Товары').find(r=>r.product_id===line.product_id);if(!product)fail('Не найден товар для возврата на склад',409);
    const stock=Number(product['Остаток, шт.']);if(!Number.isSafeInteger(stock))fail('Проверьте остаток товара',409);
    movement=uuid();const originalMovement=rows(w.sheets,'Движения склада').find(r=>r.movement_id===line.movement_id);
    w.patch('Товары',product.__row,{'Остаток, шт.':stock+q,updated_at:at});
    w.append('Движения склада',{movement_id:movement,'Дата':at,'Тип':'Возврат продажи',product_id:line.product_id,'Штрих-код':line['Штрих-код'],'Товар':line['Товар'],'Количество':q,'Цена закупки':Number(originalMovement?.['Цена закупки']||0),'Цена продажи':Number(line['Цена']||0),'Сумма':Number(line['Сумма строки']||0),'Источник':'Отмена продажи',reference_id:reversalSale,'Сотрудник':actor.email||actor.id,'Комментарий':note,'Остаток после':stock+q,request_id:p.request_id+':'+line.sale_item_id});
   }
   w.append('Строки продаж',{...copy,sale_item_id:uuid(),sale_id:reversalSale,'Количество':-q,'Скидка':-Number(line['Скидка']||0),'Сумма строки':-Number(line['Сумма строки']||0),movement_id:movement||line.movement_id||''});
   if(replacementSale)w.append('Строки продаж',{...copy,sale_item_id:uuid(),sale_id:replacementSale});
  }
  w.patch('Продажи',o.sale.__row,{'Статус':p.mode==='void'?'Отменена':'Исправлена',updated_at:at});
  if(shiftId){const state=createNativeEngine(snapshot.sheets).run('cash_state',{shift_id:shiftId},actor),shift=state.selected;event('cash',reversalSale,'sale',{shift_id:shiftId,register:shift.register,kind:'correction',original_sale_id:o.sale.sale_id});if(replacementSale)event('cash',replacementSale,'sale',{shift_id:shiftId,register:shift.register,kind:'correction',original_sale_id:o.sale.sale_id});}
 }
 if(o.payment){
  const base={...o.payment};delete base.__row;const reversal=uuid();
  w.append('Оплаты',{...base,payment_id:reversal,'Дата':at,record_id:reversalSale||o.payment.record_id,'Сумма':-o.amount/100,'Комментарий':note,request_id:p.request_id,updated_at:at});reversalIds.push('payment:'+reversal);
  if(p.mode==='edit'){const replacement=uuid();w.append('Оплаты',{...base,payment_id:replacement,'Дата':at,record_id:replacementSale||o.payment.record_id,'Сумма':nextAmount/100,'Способ оплаты':nextMethod,'Комментарий':note,request_id:p.request_id,updated_at:at});replacementIds.push('payment:'+replacement);}
  if(['repair','storage'].includes(o.payment['Тип'])){
   const kind=o.payment['Тип'],sheet=kind==='repair'?'Ремонты':'Зимнее хранение',key=kind==='repair'?'repair_id':'storage_id',raw=rows(w.sheets,sheet).find(r=>r[key]===o.payment.record_id);if(!raw)fail('Заказ оплаты не найден',409);
   const record=createNativeEngine(w.sheets).run('get',{kind,id:o.payment.record_id},actor).record;
   const paid=cents(raw['Оплачено']),total=cents(kind==='repair'?record.total_amount:record.storage_amount),after=paid-o.amount+nextAmount;
   if(after<0)fail('Часть оплаты уже возвращена. Проверьте текущую оплаченную сумму.',409);
   if(after>total&&nextAmount>o.amount)fail('Исправленная оплата превышает стоимость заказа',409);
   let status=record.status;const patch={'Оплачено':after/100,revision:record.revision+1,updated_at:at};
   if(after<total&&['issued','returned'].includes(status)){status=kind==='repair'?'ready':'stored';patch['Статус']=kind==='repair'?'Готов':'На хранении';if(kind==='repair')event('repair',raw.repair_id,'repair_steps',{...record.step_state,action:'payment_correction',payment_qr:true,completion_request_id:p.request_id});}
   if(kind==='repair'&&record.status==='ready'&&record.quality_checked===true&&record.step_state?.payment_qr===true&&after>=total&&nextAmount>o.amount){status='issued';patch['Статус']='Выдан';patch['Выдано']=at;repairCompleted=true;}
   w.patch(sheet,raw.__row,patch);paidAfter=after/100;recordStatus=status;if(kind==='repair')repairId=raw.repair_id;
   event(kind,raw[key],'payment_correction',{payment_id:o.payment.payment_id,amount_before:o.amount/100,amount_after:nextAmount/100,paid_after:paidAfter,from_status:record.status,to_status:status,reason});
  }
 }
 const replacement= replacementIds.find(key=>key.startsWith(o.payment?'payment:':'sale:'))||null;
 event('cash_correction',operationId(o.key).id,'payment_correction',{mode:p.mode,origin:o.origin,original_ids:o.aliases,reversal_ids:reversalIds,replacement_ids:replacementIds,reason,actor_name:actorName,amount_before:o.amount/100,amount_after:nextAmount/100,method_before:o.method,method_after:p.mode==='edit'?nextMethod:null,stock_restored:p.mode==='void'&&o.items.some(x=>x.product_id),shift_id:shiftId,original_shift_id:o.shiftId});
 const changes=w.changes();if(changes.length>490)fail('В документе слишком много позиций для одного исправления',400);
 return {changes,result:{request_id:p.request_id,operation_id:o.key,mode:p.mode,state:p.mode==='void'?'cancelled':'edited',replacement_operation_id:replacement,amount_before:o.amount/100,amount_after:nextAmount/100,method:p.mode==='edit'?nextMethod:null,paid_after:paidAfter,record_status:recordStatus,repair_id:repairId,repair_completed:repairCompleted,created_at:at}};
}

export async function paymentCorrections(action,p,{db,actor,device,stationName,digest}){
 if(!['payment_correction_preview','payment_correction'].includes(action))return undefined;
 if(device.kind!=='station')fail('Исправление оплаты доступно на кассовом ноутбуке',403);
 if(!canCorrectPayments(actor))fail('Исправление оплат доступно владельцу или администратору кассы',403);
 if(action==='payment_correction_preview')return paymentCorrectionPreview(await db('rpc/workshop_native_snapshot','','POST',{}),p,actor,{stationName});
 if(!id(p.request_id))fail('Неверный код исправления');
 const params={operation_id:p.operation_id,mode:p.mode,expected_amount:p.expected_amount,expected_method:p.expected_method,amount:p.amount,method:p.method,reason:p.reason,goods_returned:p.goods_returned===true,shift_id:p.shift_id||null};
 const fingerprint=await digest(JSON.stringify(params)),receipt=async()=>{const old=(await db('workshop_native_receipts','request_id=eq.'+p.request_id))[0];if(!old)return null;if(old.actor_id!==actor.id||old.action!=='warehouse_payment_correction'||old.fingerprint!==fingerprint)fail('Код исправления уже использован для другой операции',409);return old.result;};
 let result=await receipt();if(result)return result;
 for(let attempt=0;attempt<4;attempt++){
  const snapshot=await db('rpc/workshop_native_snapshot','','POST',{});let prepared;
  try{prepared=preparePaymentCorrection(snapshot,{...params,request_id:p.request_id},actor,{stationName});}catch(error){result=await receipt();if(result)return result;throw error;}
  const committed=await db('rpc/workshop_native_commit','','POST',{p_actor:actor.id,p_action:'warehouse_payment_correction',p_request_id:p.request_id,p_fingerprint:fingerprint,p_version:snapshot.version,p_changes:prepared.changes,p_result:prepared.result});
  if(!committed.retry)return committed.result;
  result=await receipt();if(result)return result;
 }
 fail('Данные изменяются другим сотрудником. Повторите это исправление.',409);
}
