import {id,fail} from './model.js';

export async function cancelDocument(action,p,{db,actor,device,stationId}){
 if(action!=='cancel_document')return undefined;
 if(!id(p.id)||!['receipt','sale','repair'].includes(p.kind)||!Number.isSafeInteger(p.revision)||p.revision<1)fail('Неверный документ');
 const read=async()=>(await db('workshop_warehouse_queue','id=eq.'+p.id+'&station_id=eq.'+stationId))[0];
 let job=await read();
 if(job){
  if(job.payload.kind!==p.kind||device.kind==='terminal'&&job.terminal_id!==device.id)fail('Документ недоступен',403);
  if(job.state==='done')return job;
  if(job.state!=='queued'||job.checkout)fail('Документ уже проводится на ноутбуке. Отмена недоступна',409);
  if(job.payload.live&&p.revision<job.payload.revision)fail('Документ изменился. Дождитесь синхронизации',409);
  if(device.kind==='station'&&job.payload.live&&p.revision!==job.payload.revision)fail('Документ изменился. Проверьте новые сканы и повторите отмену',409);
  const revision=job.payload.live?'&payload->>revision=eq.'+job.payload.revision:'';
  const changed=await db('workshop_warehouse_queue','id=eq.'+job.id+'&state=eq.queued&checkout=is.null'+revision,'PATCH',{state:'done',result:{cancelled:true},completed_at:new Date().toISOString()},'return=representation');
  job=changed[0]||await read();if(job.state!=='done')fail('Документ уже проводится на ноутбуке. Отмена недоступна',409);return job;
 }
 if(device.kind==='station')fail('Документ не найден. Обновите список оплат',404);
 // A durable tombstone also rejects a late sync/enqueue from an offline terminal.
 job={id:p.id,station_id:stationId,terminal_id:device.id,created_by:actor.id,state:'done',payload:{kind:p.kind,...(p.kind==='repair'?{repair_id:p.repair_id}:{live:true,revision:p.revision}),items:[]},result:{cancelled:true},completed_at:new Date().toISOString()};
 try{await db('workshop_warehouse_queue','','POST',job);}catch(e){if(e.status!==409)throw e;const latest=await read();if(!latest||latest.terminal_id!==device.id||latest.payload.kind!==p.kind)throw e;return cancelDocument(action,p,{db,actor,device,stationId});}
 return job;
}
