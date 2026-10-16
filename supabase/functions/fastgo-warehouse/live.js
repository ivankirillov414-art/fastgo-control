import {createNativeEngine} from '../_shared/native-engine.js';
import {items,id,fail} from './model.js';

export async function liveWarehouse(action,p,{db,actor,device,stationId,digest}) {
 if(!['draft_sync','draft_close','live_jobs','live_pay','live_receive'].includes(action))return undefined;
 if(action==='live_jobs'){
  if(device.kind!=='station')fail('Только для ноутбука',403);
  return await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&payload->>live=eq.true&order=created_at.desc&limit=30');
 }
 const requestId=p.request_id||p.id;if(!id(requestId))fail('Неверный документ');
 const read=async()=> (await db('workshop_warehouse_queue','id=eq.'+requestId+'&station_id=eq.'+stationId))[0];
 let job=await read();
 const owns=()=>{if(!job||job.payload.live!==true||device.kind==='terminal'&&job.terminal_id!==device.id)fail('Документ недоступен',403);};
 if(action==='draft_sync'){
  if(!['terminal','station'].includes(device.kind))fail('Устройство недоступно',403);
  if(!['receipt','sale'].includes(p.kind)||!Number.isSafeInteger(p.revision)||p.revision<1)fail('Неверная версия документа');
  const normalized=Array.isArray(p.items)&&!p.items.length?[]:items(p.items);
  const prices=normalized.map(x=>{const source=p.items.find(y=>y.part_id===x.part_id);if(source.custom_price===true){const n=source.unit_price;if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1e8||Math.abs(n*100-Math.round(n*100))>0.00001)fail('Проверьте свою цену');return {...x,custom_price:true,unit_price:n};}return x;});
  const payload={live:true,kind:p.kind,revision:p.revision,items:prices,note:String(p.note||'').slice(0,500),updated_at:new Date().toISOString()};
  if(!job){try{await db('workshop_warehouse_queue','','POST',{id:requestId,station_id:stationId,terminal_id:device.id,created_by:actor.id,payload});return {id:requestId,state:'queued',payload};}catch(e){if(e.status!==409)throw e;job=await read();}}
  owns();if(job.terminal_id!==device.id)fail('Этот документ сканируется на другом устройстве',403);
  if(job.payload.kind!==p.kind)fail('Тип документа уже задан',409);
  if(job.state!=='queued'||job.checkout)fail('Документ уже проводится или завершён',409);
  if(p.revision<=job.payload.revision)return job;
  await db('workshop_warehouse_queue','id=eq.'+requestId+'&state=eq.queued&checkout=is.null&payload->>revision=eq.'+job.payload.revision,'PATCH',{payload},'return=representation');
  return await read();
 }
 owns();
 if(action==='draft_close'){
  if(job.terminal_id!==device.id)fail('Этот документ открыт на другом устройстве',403);
  if(job.state==='done')return job;
  if(job.state!=='queued'||job.checkout)fail('Документ проводится; дождитесь результата',409);
  const changed=await db('workshop_warehouse_queue','id=eq.'+requestId+'&state=eq.queued&checkout=is.null','PATCH',{state:'done',result:{cancelled:true},completed_at:new Date().toISOString()},'return=representation');
  if(!changed.length)fail('Документ уже проводится',409);return changed[0];
 }
 if(job.state==='done')return job.result;
 const receiving=action==='live_receive';
 if(job.payload.kind!==(receiving?'receipt':'sale'))fail('Неверная операция');
 if(receiving&&!['owner','developer','seller'].includes(actor.role))fail('Нет права принимать товар',403);
 const station=(await db('workshop_warehouse_devices','id=eq.'+stationId))[0];
 const register=String(station?.name||'Склад').trim();
 const prepare=(snapshot,c)=>{
  const engine=createNativeEngine(snapshot.sheets);let result;
  if(receiving)result=engine.run('stock_receive',{request_id:requestId,items:c.items,note:c.note||'Приход с терминала'},actor);
  else {
   let shift=engine.run('cash_state',{},actor).shifts.find(s=>s.status==='open'&&s.register.toLowerCase()===register.toLowerCase());
   if(!shift)shift=engine.run('shift_open',{register,opening_cash:0},actor);
   result=engine.run('sale',{request_id:requestId,shift_id:shift.id,payment_method:c.payment_method,items:c.items.map(x=>({...x,price_mode:x.custom_price?'free':'base'})),discount:0,note:'Терминал · '+requestId},actor);
  }
  return {result,changes:engine.changes()};
 };
 if(!job.checkout){
  if(p.revision!==job.payload.revision)fail('Корзина изменилась. Дождитесь синхронизации',409);
  if(!receiving&&!['cash','card','transfer'].includes(p.payment_method))fail('Выберите способ оплаты');
  const c={actor_id:actor.id,mode:receiving?'receipt':'sale',payment_method:p.payment_method||'',items:items(job.payload.items).map(x=>({...x,...(job.payload.items.find(y=>y.part_id===x.part_id).custom_price?{custom_price:true,unit_price:job.payload.items.find(y=>y.part_id===x.part_id).unit_price}:{})})),note:job.payload.note};
  // The laptop may choose receipt quantities, but cannot replace scanned goods.
  // Revision CAS below refuses a simultaneous new scan before any stock write.
  if(p.items!==undefined){
   if(device.kind!=='station'||!receiving)fail('Количество прихода задаётся на ноутбуке',403);
   const chosen=items(p.items);
   if(chosen.length!==c.items.length||chosen.some(x=>!c.items.some(y=>y.part_id===x.part_id)))fail('Состав прихода изменился. Проверьте отсканированные товары',409);
   c.items=c.items.map(x=>({...x,quantity:chosen.find(y=>y.part_id===x.part_id).quantity}));
  }
  prepare(await db('rpc/workshop_native_snapshot','','POST',{}),c);
  const changed=await db('workshop_warehouse_queue','id=eq.'+requestId+'&state=eq.queued&checkout=is.null&payload->>revision=eq.'+p.revision,'PATCH',{checkout:c,state:'processing'},'return=representation');
  job=changed[0]||await read();if(job.state==='done')return job.result;
  if(!job.checkout)fail('Корзина изменилась. Повторите',409);
 }
 const c=job.checkout;if(c.actor_id!==actor.id)fail('Операцию завершает другой сотрудник',409);
 const name=receiving?'stock_receive':'sale';
 const fingerprint=await digest(JSON.stringify(c));
 const previous=async()=>{const r=(await db('workshop_native_receipts','request_id=eq.'+requestId))[0];if(!r)return null;if(r.actor_id!==actor.id||r.action!==name||r.fingerprint!==fingerprint)fail('Конфликт операции',409);return r.result;};
 let result=await previous();
 if(!result)for(let attempt=0;attempt<4;attempt++){
  const snapshot=await db('rpc/workshop_native_snapshot','','POST',{});let prepared;
  try{prepared=prepare(snapshot,c);}catch(e){result=await previous();if(result)break;throw e;}
  const commit=await db('rpc/workshop_native_commit','','POST',{p_actor:actor.id,p_action:name,p_request_id:requestId,p_fingerprint:fingerprint,p_version:snapshot.version,p_changes:prepared.changes,p_result:prepared.result});
  if(!commit.retry){result=commit.result;break;}
 }
 if(!result)fail('Склад изменился. Повторите операцию',409);
 await db('workshop_warehouse_queue','id=eq.'+requestId,'PATCH',{state:'done',result,completed_at:new Date().toISOString()});
 return result;
}
