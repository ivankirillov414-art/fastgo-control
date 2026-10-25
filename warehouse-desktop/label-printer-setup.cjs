const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {atomicWrite}=require('./backup-replica.cjs');
const CASH_STATION='ac72cfde-0839-44f4-8cb0-a78ce2eacd9c';
const DRIVER_VERSION='3.2.2026.1018',execute=promisify(execFile);
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
  const found=printers.find(isP2);if(found){this.save({status:'ready',queue_name:found.name,message:'DETONGER P2 СѓСЃС‚Р°РЅРѕРІР»РµРЅ РІ Windows.'});return this.snapshot();}
  this.read();const attempts=this.state.attempts||0;
  if(!manual&&this.state.status!=='idle'&&!(this.state.status==='download_error'&&attempts<3&&this.now()-Date.parse(this.state.updated_at)>600000))return this.snapshot();
  fs.mkdirSync(this.dir,{recursive:true});let lock;
  const lockFile=path.join(this.dir,'install.lock');
  try{if(fs.statSync(lockFile).mtimeMs<this.now()-600000)fs.unlinkSync(lockFile);}catch{}
  try{lock=fs.openSync(lockFile,'wx');}catch(error){if(error.code==='EEXIST'){this.read();return this.snapshot();}throw error;}
  this.busy=true;
  try{
   this.save({status:'installing',attempts:attempts+1,message:'РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј РґСЂР°Р№РІРµСЂ DETONGER P2. РџРѕРґС‚РІРµСЂРґРёС‚Рµ Р·Р°РїСЂРѕСЃ Windows, РµСЃР»Рё РѕРЅ РїРѕСЏРІРёС‚СЃСЏ.'});
   const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
   const {stdout}=await this.run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'label-printer-setup.ps1'),'-Directory',this.dir,'-Install'],{windowsHide:true,timeout:360000,maxBuffer:256*1024,encoding:'utf8'});
   const result=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());
   if(!['ready','driver_installed','not_connected','permission_declined','download_error','error'].includes(result.status))throw Error('Invalid driver result');
   this.save({status:result.status,message:String(result.message||'').slice(0,300),queue_name:String(result.queue_name||'').slice(0,256),connected:result.connected===true,exit_code:Number.isInteger(result.exit_code)?result.exit_code:null});
  }catch{this.save({status:'error',message:'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СѓСЃС‚Р°РЅРѕРІРєР° P2 РЅРµ Р·Р°РІРµСЂС€РёР»Р°СЃСЊ. РћС‚РєСЂРѕР№С‚Рµ В«РџСЂРёРЅС‚РµСЂ СЌС‚РёРєРµС‚РѕРєВ» Рё РЅР°Р¶РјРёС‚Рµ В«РџРѕРґРєР»СЋС‡РёС‚СЊ DETONGER P2В».'});}
  finally{this.busy=false;if(lock!==undefined)fs.closeSync(lock);try{fs.unlinkSync(path.join(this.dir,'install.lock'));}catch{}}
  return this.snapshot();
 }
}
module.exports={LabelPrinterSetup,isP2,CASH_STATION,DRIVER_VERSION};
