import {nativeClient} from '../_shared/native-client.js';

const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const printerName=v=>typeof v==='string'&&v.trim()&&v.length<=256&&!/[\x00-\x1f]/.test(v);
const virtualPrinter=name=>/PDF|XPS|OneNote|Fax|факс/i.test(name);
// Only these two thermal families have a native, dot-aligned label path. Other
// physical queues are offered only after an explicit label-profile choice on
// the laptop; a generic "printer"/"label" substring is not a capability probe.
const knownThermal=name=>/^(?:DeTong(?:er)?[ _-]*)?P2(?:[ _-]+Label[ _-]+Printer)?$/i.test(name)||/^(?:POScenter PC[- ]?365|4BARCODE 3B-365B)$/i.test(name);
const pc365=name=>/^(?:POScenter PC[- ]?365|4BARCODE 3B-365B)$/i.test(name);
const validSize=(width,height)=>typeof width==='number'&&Number.isFinite(width)&&width>=30&&width<=110&&typeof height==='number'&&Number.isFinite(height)&&height>=20&&height<=200;
function printTargets(stations,statuses,permitted,canRemember){
 return stations.filter(x=>permitted.has(x.id)).flatMap(station=>{
  // Use one newest diagnostic snapshot, never union a disconnected printer
  // from an older app/heartbeat into the current Windows printer list.
  const status=statuses.filter(s=>s.station_id===station.id&&s.details?.printing&&Number.isFinite(Date.parse(s.last_seen))).sort((a,b)=>Date.parse(b.last_seen)-Date.parse(a.last_seen))[0];
  if(!status)return [];
  const printing=status.details.printing,saved=printing.label,configured=printerName(saved?.deviceName)?saved.deviceName:'',reported=Array.isArray(printing.printers)?printing.printers:knownThermal(configured)?[{name:configured}]:[];
  const seen=new Set(),online=Date.now()-Date.parse(status.last_seen)<180000;
  const size=validSize(saved?.widthMm,saved?.heightMm)?{width_mm:saved.widthMm,height_mm:saved.heightMm}:{width_mm:58,height_mm:30};
  return reported.filter(p=>printerName(p?.name)&&!virtualPrinter(p.name)&&(knownThermal(p.name)||p.name===configured)&&!seen.has(p.name)&&seen.add(p.name)).map(p=>({id:station.id,name:station.name,printer:p.name,displayName:pc365(p.name)?'POScenter PC-365':printerName(p.displayName)?p.displayName:p.name,online,isDefault:p.name===configured,can_remember:canRemember,label_pipeline:3,...size,lastSeen:status.last_seen}));
 }).sort((a,b)=>Number(b.online)-Number(a.online)||b.lastSeen.localeCompare(a.lastSeen)||Number(b.isDefault)-Number(a.isDefault)||Number(pc365(b.printer))-Number(pc365(a.printer))||a.printer.localeCompare(b.printer));
}
export async function manualLabels(action,p,{db,actor}){
 if(!['label_targets','label_enqueue'].includes(action))return undefined;
 if(actor.role==='mechanic'||!(['owner','developer','admin'].includes(actor.role)||actor.can_edit_catalog===true))fail('Нет права печатать этикетки каталога',403);
 const allowed=await db('workshop_terminal_stations','select=station_id');
 const stations=await db('workshop_warehouse_devices','kind=eq.station&active=eq.true&select=id,name');
 const statuses=await db('workshop_device_status','app=in.(warehouse,desktop)&order=last_seen.desc&limit=30');
 const permitted=new Set(allowed.map(x=>x.station_id));
 const targets=printTargets(stations,statuses,permitted,['owner','developer'].includes(actor.role));
 if(action==='label_targets'){
  if(Number.isSafeInteger(p.label_pipeline)&&p.label_pipeline>=3)return targets.map(({lastSeen,...x})=>x);
  // Cached clients address only station IDs and omit printer_name on enqueue.
  // They can safely describe only the saved queue their worker will use.
  return targets.filter(x=>x.isDefault).map(({id,name,printer,online})=>({id,name,printer,online}));
 }
 if(!uuid(p.request_id)||!uuid(p.part_id)||!uuid(p.station_id)||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000)fail('Проверьте товар, кассу и количество этикеток от 1 до 1000');
 if(p.printer_name!==undefined&&!printerName(p.printer_name)||p.remember_printer!==undefined&&typeof p.remember_printer!=='boolean')fail('Проверьте выбранный принтер');
 if(p.remember_printer&&!['owner','developer'].includes(actor.role))fail('Основной принтер меняет владелец',403);
 if(!permitted.has(p.station_id))fail('Этот ноутбук не разрешён для печати',403);
 const sized=p.width_mm!==undefined||p.height_mm!==undefined;
 if(sized&&(!p.printer_name||!validSize(p.width_mm,p.height_mm)))fail('Укажите принтер, ширину этикетки от 30 до 110 мм и высоту от 20 до 200 мм');
 const destination=p.printer_name?{printer_name:p.printer_name,remember_printer:p.remember_printer===true,...(sized?{width_mm:Math.round(p.width_mm*10)/10,height_mm:Math.round(p.height_mm*10)/10}:{})}:{};
 const fingerprint=JSON.stringify({station_id:p.station_id,part_id:p.part_id,quantity:p.quantity,...destination});
 const previous=async()=>{
  const job=(await db('workshop_warehouse_queue','id=eq.'+p.request_id))[0];if(!job)return null;
  if(job.created_by!==actor.id||job.station_id!==p.station_id||job.payload?.kind!=='labels'||job.payload?.fingerprint!==fingerprint)fail('Код задания уже использован',409);
  return {id:job.id,status:job.result?.label_print_status};
 };
 const old=await previous();if(old)return old;
 if(!targets.some(x=>x.id===p.station_id))fail('На кассе не выбран термопринтер',409);
 if(p.printer_name&&!targets.some(x=>x.id===p.station_id&&x.printer===p.printer_name))fail('Выбранный термопринтер не найден на кассе',409);
 const g=nativeClient({db,actor,google:async()=>fail('Каталог недоступен',503),storage:{}}),catalog=await g('catalog'),part=catalog.parts.find(x=>x.id===p.part_id&&x.active!==false);
 if(!part?.barcode)fail('У товара нет штрихкода или он отключён',404);
 const job={id:p.request_id,station_id:p.station_id,terminal_id:p.station_id,created_by:actor.id,state:'done',completed_at:new Date().toISOString(),payload:{kind:'labels',source:'mobile_catalog',fingerprint,items:[{part_id:part.id,quantity:p.quantity}]},result:{label_print_status:'pending',...destination,items:[{part_id:part.id,name:part.name,barcode:part.barcode,retail_price:part.retail_price,quantity:p.quantity}]}};
 try{await db('workshop_warehouse_queue','','POST',job);}catch(e){const found=await previous();if(found)return found;throw e;}
 return {id:job.id,status:'pending'};
}
