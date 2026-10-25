import {id,fail} from './model.js';
export async function unknownScan(action,p,{db,actor,device,stationId,g,mutate}){
 if(!['scan_unknown','unknown_scans','unknown_resolve','unknown_cancel'].includes(action))return undefined;
 const read=async key=>(await db('workshop_warehouse_queue','id=eq.'+key+'&station_id=eq.'+stationId))[0];
 if(action==='unknown_scans'){
  if(device.kind!=='station')fail('Только для ноутбука',403);
  return await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&payload->>kind=eq.unknown&state=neq.done&order=created_at.asc&limit=100');
 }
 if(!id(p.id||p.request_id))fail('Неверный код скана');let row=await read(p.id||p.request_id);
 if(action==='scan_unknown'){
  if(device.kind!=='terminal')fail('Только для терминала',403);
  if(typeof p.code!=='string'||!p.code.trim()||p.code.length>2048||!id(p.document_id)||!['receipt','sale'].includes(p.kind))fail('Неверные данные скана');
  if(row){if(row.terminal_id!==device.id||row.payload.kind!=='unknown'||row.payload.code!==p.code||row.payload.document_id!==p.document_id)fail('Код скана уже используется',409);
   if(p.cancel===true&&row.state==='queued'){await db('workshop_warehouse_queue','id=eq.'+row.id+'&state=eq.queued','PATCH',{state:'done',result:{cancelled:true},completed_at:new Date().toISOString()});return {...row,state:'done',result:{cancelled:true}};}return row;
  }
  if(p.cancel===true)return {state:'done',result:{cancelled:true}};
  const aliases=await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&payload->>kind=eq.unknown&payload->>code=eq.'+encodeURIComponent(p.code)+'&state=eq.done&order=completed_at.desc&limit=1');
  const catalog=aliases[0]?.result?.part?(await g('catalog')).parts:[];
  const part=catalog.find(x=>x.id===aliases[0]?.result?.part?.id&&x.active!==false);
  const item={id:p.request_id,station_id:stationId,terminal_id:device.id,created_by:actor.id,payload:{kind:'unknown',document_kind:p.kind,document_id:p.document_id,code:p.code,items:[]},...(part?{state:'done',result:{part},completed_at:new Date().toISOString()}:{})};
  try{await db('workshop_warehouse_queue','','POST',item);}catch(e){if(e.status!==409)throw e;const old=await read(p.request_id);if(!old||old.terminal_id!==device.id||old.payload.code!==p.code)throw e;return old;}return {...item,state:part?'done':'queued'};
 }
 if(device.kind!=='station')fail('Только для ноутбука',403);
 if(!row||row.payload.kind!=='unknown')fail('Скан недоступен',404);
 if(row.state==='done')return row.result;
 if(action==='unknown_cancel'){
  if(row.state!=='queued'||row.checkout)fail('Позиция уже создаётся. Дождитесь результата',409);
  const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&station_id=eq.'+stationId+'&state=eq.queued&checkout=is.null','PATCH',{state:'done',result:{cancelled:true},completed_at:new Date().toISOString()},'return=representation');
  const latest=changed[0]||await read(row.id);if(latest?.state!=='done')fail('Скан изменился. Обновите список',409);return latest.result;
 }
 let part;
 if(p.create){
  if(!['owner','developer'].includes(actor.role))fail('Создание товара доступно владельцу',403);
  const input={name:String(p.create.name||'').trim(),category:String(p.create.category||'').trim(),retail_price:Number(p.create.retail_price),unit_cost:0};
  if(!input.name||!input.category||!Number.isFinite(input.retail_price)||input.retail_price<0||input.retail_price>1e8)fail('Проверьте название, категорию и цену');
  if(!row.checkout){const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&state=eq.queued&checkout=is.null','PATCH',{state:'processing',checkout:{actor_id:actor.id,create:input}},'return=representation');row=changed[0]||await read(row.id);}
  if(row.state==='done')return row.result;
  if(row.checkout?.actor_id!==actor.id)fail('Позицию создаёт другой сотрудник',409);
  part=await mutate('part_save',{...row.checkout.create,request_id:row.id});
 }else{
  if(row.checkout)fail('Завершите создание новой позиции',409);
  if(!id(p.part_id))fail('Выберите товар');part=(await g('catalog')).parts.find(x=>x.id===p.part_id&&x.active!==false);if(!part)fail('Товар не найден',404);
 }
 const result={part};await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&payload->>kind=eq.unknown&payload->>code=eq.'+encodeURIComponent(row.payload.code)+'&state=eq.queued&checkout=is.null','PATCH',{state:'done',result,completed_at:new Date().toISOString()});const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&state=neq.done','PATCH',{state:'done',result,completed_at:new Date().toISOString()},'return=representation');return changed[0]?.result||(await read(row.id)).result;
}
