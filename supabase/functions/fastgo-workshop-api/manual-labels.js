import {nativeClient} from '../_shared/native-client.js';

const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export async function manualLabels(action,p,{db,actor}){
 if(!['label_targets','label_enqueue'].includes(action))return undefined;
 if(actor.role==='mechanic'||!(['owner','developer','admin'].includes(actor.role)||actor.can_edit_catalog===true))fail('Нет права печатать этикетки каталога',403);
 const allowed=await db('workshop_terminal_stations','select=station_id');
 const stations=await db('workshop_warehouse_devices','kind=eq.station&active=eq.true&select=id,name');
 const statuses=await db('workshop_device_status','app=in.(warehouse,desktop)&order=last_seen.desc&limit=30');
 const permitted=new Set(allowed.map(x=>x.station_id));
 const targets=stations.filter(x=>permitted.has(x.id)).map(x=>{
  const status=statuses.find(s=>s.station_id===x.id&&s.details?.printing?.label?.deviceName),printer=status?.details?.printing?.label?.deviceName;
  return {id:x.id,name:x.name,printer:printer||'',online:!!status&&Date.now()-Date.parse(status.last_seen)<180000,lastSeen:status?.last_seen||''};
 }).filter(x=>x.printer).sort((a,b)=>Number(b.online)-Number(a.online)||b.lastSeen.localeCompare(a.lastSeen));
 if(action==='label_targets')return targets.map(({lastSeen,...x})=>x);
 if(!uuid(p.request_id)||!uuid(p.part_id)||!uuid(p.station_id)||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000)fail('Проверьте товар, кассу и количество этикеток от 1 до 1000');
 if(!permitted.has(p.station_id))fail('Этот ноутбук не разрешён для печати',403);
 const fingerprint=JSON.stringify({station_id:p.station_id,part_id:p.part_id,quantity:p.quantity});
 const previous=async()=>{
  const job=(await db('workshop_warehouse_queue','id=eq.'+p.request_id))[0];if(!job)return null;
  if(job.created_by!==actor.id||job.station_id!==p.station_id||job.payload?.kind!=='labels'||job.payload?.fingerprint!==fingerprint)fail('Код задания уже использован',409);
  return {id:job.id,status:job.result?.label_print_status};
 };
 const old=await previous();if(old)return old;
 if(!targets.some(x=>x.id===p.station_id))fail('На кассе не выбран термопринтер',409);
 const g=nativeClient({db,actor,google:async()=>fail('Каталог недоступен',503),storage:{}}),catalog=await g('catalog'),part=catalog.parts.find(x=>x.id===p.part_id&&x.active!==false);
 if(!part?.barcode)fail('У товара нет штрихкода или он отключён',404);
 const job={id:p.request_id,station_id:p.station_id,terminal_id:p.station_id,created_by:actor.id,state:'done',completed_at:new Date().toISOString(),payload:{kind:'labels',source:'mobile_catalog',fingerprint,items:[{part_id:part.id,quantity:p.quantity}]},result:{label_print_status:'pending',items:[{part_id:part.id,name:part.name,barcode:part.barcode,retail_price:part.retail_price,quantity:p.quantity}]}};
 try{await db('workshop_warehouse_queue','','POST',job);}catch(e){const found=await previous();if(found)return found;throw e;}
 return {id:job.id,status:'pending'};
}
