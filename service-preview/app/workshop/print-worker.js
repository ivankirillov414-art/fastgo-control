// Mark the irreversible boundary before invoking the browser. Never auto-reprint
// a dispatched job: window.print() cannot confirm that a physical sheet exists.
export async function runPrintJob(job,{prepare,call,print}){
 let dispatched=false;
 try{
  await prepare(job);
  await call('dispatch',{job_id:job.id});dispatched=true;
  await print();
  await call('complete',{job_id:job.id});
 }catch(error){
  if(!dispatched)await call('fail',{job_id:job.id,error:String(error.message||error)}).catch(()=>{});
  throw error;
 }
}
