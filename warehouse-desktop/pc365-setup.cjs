const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {atomicWrite}=require('./backup-replica.cjs'),{CASH_STATION}=require('./label-printer-setup.cjs');
const HASH='3ccc3c12e59d67735ae3edd30d0fbd51e2d00040f6e1aa95aa29296af06f2d2c';
const isPC365=p=>/^(?:POScenter PC[- ]?365|4BARCODE 3B-365B)$/i.test(p?.name||'');
function materialize(dir){
 const hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex'),source=process.resourcesPath&&fs.existsSync(path.join(process.resourcesPath,'pc365-driver/manifest.json'))?path.join(process.resourcesPath,'pc365-driver'):path.join(__dirname,'pc365-driver'),raw=fs.readFileSync(path.join(source,'manifest.json'));
 if(hash(raw)!==HASH)throw Error('PC365 manifest checksum mismatch');
 for(const f of JSON.parse(raw).files){if(!/^(?:(?:Common|x64|Win32)\/)?[a-z0-9_#.[\]-]+$/i.test(f.path)||f.path.includes('..'))throw Error('Invalid driver path');const bytes=fs.readFileSync(path.join(source,f.path));if(hash(bytes)!==f.sha256)throw Error('PC365 driver checksum mismatch');atomicWrite(path.join(dir,'driver',f.path),bytes);}
 atomicWrite(path.join(dir,'driver/manifest.json'),raw);const helper=path.join(dir,'pc365-setup.ps1');atomicWrite(helper,fs.readFileSync(path.join(__dirname,'pc365-setup.ps1')));return helper;
}
class PC365Setup{
 constructor({dir,station=async()=>'',run=promisify(execFile),enabled=true,platform=process.platform,now=Date.now}){Object.assign(this,{dir,station,run,enabled,platform,now});this.busy=false;this.at=0;this.state={status:'idle'};this.read();}
 read(){try{this.state=JSON.parse(fs.readFileSync(path.join(this.dir,'receipt.json'),'utf8'));}catch{}return this.snapshot();}
 snapshot(){return {...this.state,busy:this.busy};}
 async ensure({printers=[],manual=false}={}){
  if(!this.enabled||this.platform!=='win32'||this.busy||await this.station()!==CASH_STATION)return this.snapshot();
  this.read();if(!manual&&(['ready','driver_installed','permission_declined','error'].includes(this.state.status)||this.now()-this.at<60000))return this.snapshot();
  this.at=this.now();fs.mkdirSync(this.dir,{recursive:true});let lock;const lockFile=path.join(this.dir,'install.lock');
  try{if(fs.statSync(lockFile).mtimeMs<this.now()-600000)fs.unlinkSync(lockFile);}catch{}
  try{lock=fs.openSync(lockFile,'wx');}catch(e){if(e.code==='EEXIST')return this.snapshot();throw e;}
  this.busy=true;this.state={status:'installing',message:'Проверяем подключение POScenter PC-365…'};
  try{
   const helper=materialize(this.dir),shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
   const {stdout}=await this.run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Directory',this.dir,'-Install'],{windowsHide:true,timeout:360000,maxBuffer:256*1024,encoding:'utf8'});
   const result=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());if(!['ready','driver_installed','not_connected','permission_declined','error'].includes(result.status))throw Error('Invalid driver result');this.state=result;
  }catch{this.state={status:'error',message:'Не удалось настроить POScenter PC-365. Повторите подключение в настройках принтера.'};}
  finally{this.busy=false;this.state.updated_at=new Date(this.now()).toISOString();atomicWrite(path.join(this.dir,'receipt.json'),Buffer.from(JSON.stringify(this.state)));if(lock!==undefined)fs.closeSync(lock);try{fs.unlinkSync(lockFile);}catch{}}
  return this.snapshot();
 }
}
module.exports={PC365Setup,materialize,isPC365,HASH};
