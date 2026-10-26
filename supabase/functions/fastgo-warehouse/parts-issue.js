import {createNativeEngine} from '../_shared/native-engine.js';
import {readPickupCode,pickupCode} from '../_shared/parts-pickup-code.js';
import {repairIdFromCode} from './repair.js';
import {items,id,fail} from './model.js';
function eventDetails(e){try{return JSON.parse(e['Детали']||'{}');}catch{return {};}}
export function pickupRepair(snapshot,ticket){
 const r=snapshot.sheets['Ремонты'].rows.find(x=>x.repair_id===ticket.repair_id);if(!r)fail('Ремонт не найден',404);
 if(!['Принят','Принято','Новая','Диагностика','На диагностике','Ждём запчасти','Ожидает запчасть','В ремонте','В работе'].includes(r['Статус']))fail('Выдача деталей доступна для незавершённого ремонта',409);
 if(r.master_id!==ticket.master_id)fail('Мастер ремонта изменился. Откройте новый QR ремонта.',409);
 if(snapshot.sheets['События'].rows.some(e=>e['Действие']==='parts_issued'&&eventDetails(e).ticket_id===ticket.id))fail('По этому QR детали уже выданы. Для следующей выдачи откройте новый QR.',409);
 const intake=snapshot.sheets['Приёмки'].rows.find(x=>x.intake_id===r.intake_id)||{};
 return {raw:r,id:r.repair_id,number:r['Номер ремонта'],vehicle:intake['Бренд / модель']||'',serial:intake['Серийный номер']||'',master_id:r.master_id,master_name:r['Мастер']||''};
}
export function preparePartsIssue(snapshot,p,ticket,actor,{uuid=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 const repair=pickupRepair(snapshot,ticket),normalized=items(p.items),engine=createNativeEngine(snapshot.sheets,{uuid,now}),rows=JSON.parse(repair.raw['Строки запчастей']||'[]'),issued=[];
 for(const item of normalized){
  const product=engine.sheets['Товары'].rows.find(x=>x.product_id===item.part_id&&x['Активен']!==false);if(!product)fail('Запчасть отключена или не найдена',404);
  const price=Number(product['Цена продажи, ₽'])||0;
  engine.run('stock',{...item,movement_type:'issue',note:(p.scanner_source==='atol'?'Выдача сканером кассы в ремонт ':'Выдача ТСД в ремонт ')+repair.number+' · '+repair.master_name,reference_id:repair.id,request_id:p.request_id+':'+item.part_id},{...actor,role:'manager'});
  rows.push({part_id:item.part_id,name:product['Модель / название'],quantity:item.quantity,price,tsd_issue_id:p.request_id,unit_cost:Number(product['Цена закупки, ₽'])||0});
  issued.push({...item,name:product['Модель / название'],unit_price:price});
 }
 const partsTotal=Math.round(rows.reduce((n,x)=>n+Number(x.price)*Number(x.quantity||1),0)*100)/100,old=repair.raw;
 // An explicit customer price remains explicit; otherwise adding parts recalculates the estimate.
 const record=engine.run('get',{kind:'repair',id:repair.id},{...actor,role:'owner'}).record;
 const total=record.total_override??Math.round((Number(old['Стоимость работ']||0)+partsTotal-Number(old['Скидка']||0))*100)/100;
 const changes=[...engine.changes(),{sheet:'Ремонты',row:old.__row,values:{'Строки запчастей':JSON.stringify(rows),'Запчасти':partsTotal,'Итого':total,'Контроль качества':false,'Согласовано, ₽':Math.abs(Number(old['Итого'])-total)<.005?old['Согласовано, ₽']:'','Примечание согласования':Math.abs(Number(old['Итого'])-total)<.005?old['Примечание согласования']:'',updated_at:now(),revision:Math.max(1,Number(old.revision)||1)+1}}];
 const result={id:p.request_id,repair_id:repair.id,number:repair.number,vehicle:repair.vehicle,serial:repair.serial,master_id:repair.master_id,master_name:repair.master_name,items:issued,total};
 changes.push({sheet:'События',row:Math.max(1,...engine.sheets['События'].rows.map(x=>x.__row))+1,values:{event_id:uuid(),'Дата':now(),'Тип':'repair',record_id:repair.id,'Действие':'parts_issued',actor_id:actor.id,'Детали':JSON.stringify({...result,ticket_id:ticket.id,terminal_id:p.terminal_id,station_id:p.station_id,scanner_source:p.scanner_source}),updated_at:now()}});
 return {changes,result};
}
export async function partsIssue(action,p,{db,actor,device,stationId,key,digest}){
 if(!['parts_pickup_quote','parts_issue'].includes(action))return undefined;
 if(!['terminal','station'].includes(device.kind))fail('Выдавайте детали сканированием на кассе',403);
 let code=p.code,ticket,snapshot;
 if(action==='parts_pickup_quote'&&typeof code==='string'&&!code.startsWith('FGPARTS1.')){
  const repairId=await repairIdFromCode(code,key);snapshot=await db('rpc/workshop_native_snapshot','','POST',{});
  const repair=snapshot.sheets['Ремонты'].rows.find(r=>r.repair_id===repairId);if(!repair)fail('Ремонт не найден',404);
  if(!id(repair.master_id))fail('Сначала назначьте мастера в карточке ремонта',409);
  code=(await pickupCode({id:repairId,assigned_master_id:repair.master_id},key)).code;
 }
 ticket=await readPickupCode(code,key,{allowExpired:action==='parts_issue'});
 const active=async()=>{if(!(await db('workshop_members','profile_id=eq.'+ticket.master_id+'&active=eq.true&role=eq.mechanic&select=profile_id')).length)fail('Мастер отключён',409);};
 if(action==='parts_pickup_quote'){await active();const q=pickupRepair(snapshot||await db('rpc/workshop_native_snapshot','','POST',{}),ticket);delete q.raw;return {...q,code};}
 if(!id(p.request_id))fail('Неверный код выдачи');const normalized=items(p.items),fingerprint=await digest(JSON.stringify({code:p.code,items:normalized,terminal_id:device.id,station_id:stationId}));
 // Receipt lookup precedes expiry/assignment checks on retries: a committed issue is final.
 const receipt=async()=>{const old=(await db('workshop_native_receipts','request_id=eq.'+p.request_id))[0];if(!old)return null;if(old.action!=='warehouse_parts_issue'||old.actor_id!==actor.id||old.fingerprint!==fingerprint)fail('Код выдачи уже использован',409);return old.result;};
 let result=await receipt();if(result)return result;
 if(ticket.expires*1000<=Date.now())fail('QR выдачи истёк. Мастеру нужно снова нажать «Взять запчасти».',409);
 await active();
 for(let n=0;n<4;n++){
  const snapshot=await db('rpc/workshop_native_snapshot','','POST',{});result=await receipt();if(result)return result;
  let prepared;try{prepared=preparePartsIssue(snapshot,{...p,items:normalized,terminal_id:device.id,station_id:stationId,scanner_source:device.kind==='station'?'atol':'tsd'},ticket,actor);}catch(e){result=await receipt();if(result)return result;throw e;}
  const commit=await db('rpc/workshop_native_commit','','POST',{p_actor:actor.id,p_action:'warehouse_parts_issue',p_request_id:p.request_id,p_fingerprint:fingerprint,p_version:snapshot.version,p_changes:prepared.changes,p_result:prepared.result});
  if(!commit.retry)return commit.result;
 }
 fail('Данные изменились. Повторите ту же выдачу.',409);
}
