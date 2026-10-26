import {id,fail} from './model.js';

// The receipt and its label outbox are published together only after the stock
// commit succeeds. Older receipts have no marker and are never back-printed.
export async function receiptLabels(action,p,{db,device,stationId}){
 if(!['receipt_label_jobs','receipt_label_ack'].includes(action))return undefined;
 if(device.kind!=='station')fail('Печать выполняется на кассовом ноутбуке',403);
 if(action==='receipt_label_jobs')return await db('workshop_warehouse_queue','station_id=eq.'+stationId+'&state=eq.done&payload->>kind=in.(receipt,labels)&result->>label_print_status=eq.pending&order=completed_at.asc&limit=50');
 if(!id(p.id))fail('Неверный приход');
 const job=(await db('workshop_warehouse_queue','id=eq.'+p.id+'&station_id=eq.'+stationId))[0];
 if(!job||job.state!=='done'||!['receipt','labels'].includes(job.payload.kind)||!job.result?.label_print_status)fail('Задание печати не найдено',404);
 if(job.result.label_print_status==='printed')return {printed:true};
 if(job.result.label_print_status!=='pending')fail('Задание печати недоступно',409);
 await db('workshop_warehouse_queue','id=eq.'+p.id+'&station_id=eq.'+stationId+'&state=eq.done&result->>label_print_status=eq.pending','PATCH',{result:{...job.result,label_print_status:'printed',label_printed_at:new Date().toISOString()}});
 return {printed:true};
}
