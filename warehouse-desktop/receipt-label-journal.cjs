const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicWrite}=require('./backup-replica.cjs');
const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class ReceiptLabelJournal{
 constructor(dir){this.dir=dir;}
 async run(job,print){
  if(!job||!guid.test(job.id)||!Array.isArray(job.items)||job.items.length<1||job.items.length>40)throw Error('Неверное задание этикеток прихода');
  const normalized=job.items.map(x=>{if(!x||typeof x.name!=='string'||typeof x.barcode!=='string'||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>1000)throw Error('Проверьте этикетки прихода');return {name:x.name,barcode:x.barcode,quantity:x.quantity,...(x.price===undefined?{}:{price:x.price})};});
  if(job.printer_name!==undefined&&(typeof job.printer_name!=='string'||!job.printer_name||job.printer_name.length>256))throw Error('Неверный принтер этикеток');
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(job.printer_name?{printer:job.printer_name,items:normalized}:normalized)).digest('hex');
  fs.mkdirSync(this.dir,{recursive:true});const file=path.join(this.dir,job.id+'.json'),lock=file+'.lock';let handle;
  try{handle=fs.openSync(lock,'wx');fs.writeFileSync(handle,JSON.stringify({pid:process.pid}));}
  catch(error){if(error.code!=='EEXIST')throw error;let live=true;try{const pid=JSON.parse(fs.readFileSync(lock,'utf8')).pid;if(!Number.isSafeInteger(pid)||pid<1)throw Error('Некорректная блокировка печати');try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')live=false;}}catch{throw Error('Проверьте журнал печати прихода');}if(live)throw Error('Этикетки этого прихода уже печатаются');fs.unlinkSync(lock);return this.run(job,print);}
  try{
   let state;try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Не удалось прочитать журнал печати; автоматический повтор остановлен');state={fingerprint,lines:normalized.map(()=>({status:'pending'}))};}
   if(state.fingerprint!==fingerprint||state.lines.length!==job.items.length)throw Error('Состав этикеток прихода изменился; автоматический повтор остановлен');
   const persist=()=>atomicWrite(file,Buffer.from(JSON.stringify(state)));
   for(let i=0;i<job.items.length;i++){
    if(state.lines[i].status==='printed')continue;
    if(state.lines[i].status==='submitting')throw Error('Windows могла уже принять этикетки этого прихода. Проверьте печать; повтор автоматически остановлен');
    // The printer callback must distinguish validation/preparation failures from
    // an interrupted submission. Never silently repeat an ambiguous spool call.
    let started=false;
    await print(job.items[i],()=>{started=true;state.lines[i]={status:'submitting'};persist();}).then(()=>{state.lines[i]={status:'printed',at:new Date().toISOString()};persist();},error=>{if(!started||error.notSubmitted===true){state.lines[i]={status:'pending'};persist();}throw error;});
   }
   const alreadyPrinted=state.completed===true;state.completed=true;persist();return {printed:true,alreadyPrinted};
  }finally{if(handle!==undefined)fs.closeSync(handle);try{fs.unlinkSync(lock);}catch{}}
 }
}
module.exports={ReceiptLabelJournal};
