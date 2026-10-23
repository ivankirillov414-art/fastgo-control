import {id,fail} from './model.js';
import {repairIdFromCode,repairQuote} from './repair.js';

// Older native terminals send an unmatched QR through scan_unknown in sale mode.
// Keep that protocol usable, but route a FastGo repair QR to cashier confirmation.
export async function repairScan(action,p,{db,actor,device,stationId,key}){
 if(action!=='scan_unknown'||typeof p.code!=='string')return undefined;
 let url;try{url=new URL(p.code.trim());}catch{return undefined;}
 if(url.origin!=='https://ivankirillov414-art.github.io'||!['/fastgo-control/workshop.html','/fastgo-control/repair-status.html'].includes(url.pathname))return undefined;
 if(device.kind!=='terminal')fail('Только для терминала',403);
 if(p.kind!=='sale')fail('QR ремонта сканируется в «Оплате»');
 if(!id(p.request_id)||!id(p.document_id))fail('Неверный код скана');
 const repairId=await repairIdFromCode(p.code,key);
 const read=async()=>(await db('workshop_warehouse_queue','id=eq.'+p.request_id+'&station_id=eq.'+stationId))[0];
 let row=await read();
 if(row&&(row.terminal_id!==device.id||!['unknown','repair'].includes(row.payload.kind)||row.payload.code!==p.code||row.payload.document_id!==p.document_id))fail('Код скана уже используется',409);
 if(row?.state==='done')return row;
 if(p.cancel===true){
  if(!row)return {state:'done',result:{cancelled:true}};
  if(row.state!=='queued'||row.checkout)fail('Оплата уже проводится на ноутбуке',409);
  const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&state=eq.queued&checkout=is.null','PATCH',{state:'done',result:{cancelled:true},completed_at:new Date().toISOString()},'return=representation');
  return changed[0]||await read();
 }
 if(row?.payload.kind==='repair')return row;
 const quote=repairQuote(await db('rpc/workshop_native_snapshot','','POST',{}),repairId,actor);
 const payload={kind:'repair',repair_id:repairId,repair:quote,items:[],code:p.code,document_id:p.document_id};
 if(row){
  const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&payload->>kind=eq.unknown&state=eq.queued&checkout=is.null','PATCH',{payload},'return=representation');
  return changed[0]||await read();
 }
 const created={id:p.request_id,station_id:stationId,terminal_id:device.id,created_by:actor.id,payload};
 try{await db('workshop_warehouse_queue','','POST',created);}catch(e){if(e.status!==409)throw e;row=await read();if(!row||row.terminal_id!==device.id||row.payload.code!==p.code||row.payload.document_id!==p.document_id)throw e;return row;}
 return {...created,state:'queued'};
}
