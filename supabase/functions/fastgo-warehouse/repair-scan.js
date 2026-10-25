import {id,fail} from './model.js';
// A repair QR captured as a product is rejected, never redirected into payment.
export async function repairScan(action,p,{db,device,stationId}){
 if(action!=='scan_unknown'||typeof p.code!=='string')return undefined;
 let url;try{url=new URL(p.code.trim());}catch{return undefined;}
 if(url.origin!=='https://ivankirillov414-art.github.io'||!['/fastgo-control/workshop.html','/fastgo-control/repair-status.html'].includes(url.pathname))return undefined;
 if(device.kind!=='terminal')fail('Только для терминала',403);
 if(!['sale','receipt'].includes(p.kind)||!id(p.request_id)||!id(p.document_id))fail('Неверный код скана');
 const read=async()=>(await db('workshop_warehouse_queue','id=eq.'+p.request_id+'&station_id=eq.'+stationId))[0];let row=await read();
 if(row&&(row.terminal_id!==device.id||!['unknown','repair'].includes(row.payload.kind)||row.payload.code!==p.code||row.payload.document_id!==p.document_id))fail('Код скана уже используется',409);
 if(row?.state==='done')return row;
 const result={cancelled:true,wrong_section:true,message:'Откройте раздел «Оплата ремонта» и повторите сканирование'};
 if(row){if(row.state!=='queued'||row.checkout)fail('Документ уже проводится',409);const changed=await db('workshop_warehouse_queue','id=eq.'+row.id+'&state=eq.queued&checkout=is.null','PATCH',{state:'done',result,completed_at:new Date().toISOString()},'return=representation');row=changed[0]||await read();if(row?.state!=='done')fail('Документ уже проводится',409);return row;}
 return {state:'done',result};
}
