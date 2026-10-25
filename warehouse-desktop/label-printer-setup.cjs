const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {atomicWrite}=require('./backup-replica.cjs');
const CASH_STATION='ac72cfde-0839-44f4-8cb0-a78ce2eacd9c';
const DRIVER_VERSION='2.1.2026.0508',execute=promisify(execFile);
const MANIFEST_HASH='a2a4732c56f093f3972293abeb618cfffe71b9dbad8b03c0cf500004c0311847';
function materialize(dir){
 const hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex'),source=path.join(__dirname,'p2-driver'),raw=fs.readFileSync(path.join(source,'manifest.json'));
 if(hash(raw)!==MANIFEST_HASH)throw Error('P2 manifest checksum mismatch');
 const manifest=JSON.parse(raw);
 for(const f of manifest.files){if(!/^(?:(?:amd64|x86)\/)?P2[PUI]*\.(?:dll|gpd|ini|inf|cat)$/i.test(f.path))throw Error('Invalid P2 package path');const bytes=fs.readFileSync(path.join(source,f.path));if(hash(bytes)!==f.sha256)throw Error('P2 package checksum mismatch');atomicWrite(path.join(dir,'driver',f.path),bytes);}
 atomicWrite(path.join(dir,'driver','manifest.json'),raw);
 const helper=path.join(dir,'label-printer-setup.ps1');atomicWrite(helper,fs.readFileSync(path.join(__dirname,'label-printer-setup.ps1')));return helper;
}
const isP2=printer=>/^(?:DeTong(?:er)?[ _-]*)?P2(?:[ _-]+Label[ _-]+Printer)?$/i.test(printer?.name||'');
class LabelPrinterSetup{
 constructor({dir,station=async()=>'',run=execute,platform=process.platform,enabled=true,now=()=>Date.now()}){Object.assign(this,{dir,station,run,platform,enabled,now});this.busy=false;this.state={status:'idle',message:'',driver_version:DRIVER_VERSION};this.read();}
 read(){try{const value=JSON.parse(fs.readFileSync(path.join(this.dir,'receipt.json'),'utf8'));if(value.driver_version===DRIVER_VERSION){this.state=value;if(value.status==='installing'&&!this.busy&&this.now()-Date.parse(value.updated_at)>360000)this.state={...value,status:'error',message:'Установка P2 была прервана. Повторите подключение принтера в настройках.'};}}catch{}return this.snapshot();}
 snapshot(){return {...this.state,busy:this.busy};}
 save(value){this.state={...this.state,...value,driver_version:DRIVER_VERSION,updated_at:new Date(this.now()).toISOString()};atomicWrite(path.join(this.dir,'receipt.json'),Buffer.from(JSON.stringify(this.state)));}
 async ensure({printers=[],manual=false}={}){
  if(!this.enabled||this.platform!=='win32'||this.busy)return this.snapshot();
  // Automatic setup belongs to the cash station, not the developer's laptop.
  if(!manual&&await this.station()!==CASH_STATION)return this.snapshot();
  const found=printers.find(isP2);if(found){this.save({status:'ready',queue_name:found.name,message:'DETONGER P2 установлен в Windows.'});return this.snapshot();}
  this.read();const attempts=this.state.attempts||0;
  if(!manual&&this.state.status!=='idle'&&!(this.state.status==='download_error'&&attempts<3&&this.now()-Date.parse(this.state.updated_at)>600000))return this.snapshot();
  fs.mkdirSync(this.dir,{recursive:true});let lock;
  const lockFile=path.join(this.dir,'install.lock');
  try{if(fs.statSync(lockFile).mtimeMs<this.now()-600000)fs.unlinkSync(lockFile);}catch{}
  try{lock=fs.openSync(lockFile,'wx');}catch(error){if(error.code==='EEXIST'){this.read();return this.snapshot();}throw error;}
  this.busy=true;
  try{
   this.save({status:'installing',attempts:attempts+1,message:'Устанавливаем драйвер DETONGER P2. Подтвердите запрос Windows, если он появится.'});
   const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
   const helper=materialize(this.dir);
   const {stdout}=await this.run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Directory',this.dir,'-Install'],{windowsHide:true,timeout:360000,maxBuffer:256*1024,encoding:'utf8'});
   const result=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());
   if(!['ready','driver_installed','not_connected','permission_declined','download_error','error'].includes(result.status))throw Error('Invalid driver result');
   this.save({status:result.status,message:String(result.message||'').slice(0,300),queue_name:String(result.queue_name||'').slice(0,256),connected:result.connected===true,exit_code:Number.isInteger(result.exit_code)?result.exit_code:null});
  }catch{this.save({status:'error',message:'Автоматическая установка P2 не завершилась. Откройте «Принтер этикеток» и нажмите «Подключить DETONGER P2».'});}
  finally{this.busy=false;if(lock!==undefined)fs.closeSync(lock);try{fs.unlinkSync(path.join(this.dir,'install.lock'));}catch{}}
  return this.snapshot();
 }
}
module.exports={LabelPrinterSetup,isP2,CASH_STATION,DRIVER_VERSION,materialize,MANIFEST_HASH};
