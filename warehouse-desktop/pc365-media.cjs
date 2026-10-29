const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {labelSize}=require('./printer-profiles.cjs'),{isPC365}=require('./pc365-setup.cjs'),{atomicWrite}=require('./backup-replica.cjs');
// A media command is not a product label and never marks a label job printed.
class PC365Media{
 constructor({dir,enabled=true,platform=process.platform,run=promisify(execFile),now=Date.now}){Object.assign(this,{dir,enabled,platform,run,now});this.busy=false;}
 snapshot(){try{return JSON.parse(fs.readFileSync(path.join(this.dir,'media.json'),'utf8'));}catch{return {};}}
 async restore({deviceName,widthMm,heightMm,force=false}){
  if(!this.enabled||this.platform!=='win32'||!isPC365({name:deviceName}))return {skipped:true};
  const size=labelSize({widthMm,heightMm}),key=JSON.stringify([2,deviceName,size.widthMm,size.heightMm]),receipt=path.join(this.dir,'media.json');
  try{if(!force&&JSON.parse(fs.readFileSync(receipt,'utf8')).key===key)return {alreadySubmitted:true};}catch{}
  if(this.busy)throw Error('Дождитесь выравнивания этикеток PC-365');
  fs.mkdirSync(this.dir,{recursive:true});let lock;
  try{if(fs.statSync(path.join(this.dir,'media.lock')).mtimeMs<this.now()-120000)fs.unlinkSync(path.join(this.dir,'media.lock'));}catch{}
  try{lock=fs.openSync(path.join(this.dir,'media.lock'),'wx');}catch(e){if(e.code==='EEXIST')throw Error('Выравнивание PC-365 уже запущено в другом окне');throw e;}
  this.busy=true;
  try{
   const helper=path.join(this.dir,'pc365-media.ps1');atomicWrite(helper,fs.readFileSync(path.join(__dirname,'pc365-media.ps1')));
   const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
   const {stdout}=await this.run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-PrinterName',deviceName,'-WidthMm',String(size.widthMm),'-HeightMm',String(size.heightMm)],{windowsHide:true,timeout:30000,maxBuffer:32768,encoding:'utf8'});
   const result=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());
   if(result.status!=='submitted'||!Number.isSafeInteger(result.job_id)||result.job_id<1)throw Error(result.message||'Принтер не принял команду выравнивания');
   atomicWrite(receipt,Buffer.from(JSON.stringify({key,...size,deviceName,job_id:result.job_id,windows_media:result.windows_media||null,submitted_at:new Date(this.now()).toISOString(),physical_result_verified:false})));
   return {submitted:true,job_id:result.job_id,message:'Команда выравнивания отправлена PC-365. Принтер протянет несколько этикеток. После остановки проверьте пробную этикетку.'};
  }catch(e){let message;try{message=JSON.parse(String(e.stdout||'').replace(/^\uFEFF/,'').trim()).message;}catch{}throw Error(message||'Не удалось выровнять PC-365. Проверьте бумагу, подключение и очередь печати.');}
  finally{this.busy=false;if(lock!==undefined)fs.closeSync(lock);try{fs.unlinkSync(path.join(this.dir,'media.lock'));}catch{}}
 }
}
module.exports={PC365Media};
