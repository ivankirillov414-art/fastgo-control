const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),feed='https://raw.githubusercontent.com/ivankirillov414-art/fastgo-control/main/warehouse/update/latest.yml';
const newer=(a,b)=>a.split('.').map(Number).some((v,i,all)=>all.slice(0,i).every((n,j)=>n===Number(b.split('.')[j]))&&v>Number(b.split('.')[i]));
function metadata(text){
 const version=text.match(/^version: (\d+\.\d+\.\d+)\s*$/m)?.[1],url=text.match(/^\s*- url: (https:\/\/\S+)\s*$/m)?.[1],sha512=text.match(/^\s+sha512: ([A-Za-z0-9+/]{86}==)\s*$/m)?.[1],size=Number(text.match(/^\s+size: (\d+)\s*$/m)?.[1]);
 if(!version||!sha512||!Number.isSafeInteger(size)||size<1000000||size>300*1024*1024||url!==`https://github.com/ivankirillov414-art/fastgo-control/releases/download/fastgo-warehouse-v${version}/FastGo-Warehouse-Setup-${version}-Windows-x64.exe`)throw Error('Неверный выпуск FastGo Склад');
 return {version,url,sha512,size};
}
function installed(folder){try{const p=JSON.parse(fs.readFileSync(path.join(folder,'resources/app.asar/package.json'),'utf8'));return p.name==='fastgo-warehouse-desktop'&&/^\d+\.\d+\.\d+$/.test(p.version)?{folder,version:p.version}:null;}catch{return null;}}
async function discover(){
 const script="$roots=@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); @(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -like 'FastGo*' -and $_.InstallLocation} | ForEach-Object {$_.InstallLocation}) | ConvertTo-Json -Compress";
 const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:20000,maxBuffer:1024*1024});
 const value=stdout.trim()?JSON.parse(stdout):[],folders=Array.isArray(value)?value:[value];
 return folders.map(folder=>typeof folder==='string'&&path.isAbsolute(folder)?installed(path.resolve(folder)):null).find(Boolean)||null;
}
async function running(folder){
 const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-CimInstance Win32_Process -Filter \"Name like 'FastGo%'\" | ForEach-Object {$_.ExecutablePath}) | ConvertTo-Json -Compress"],{windowsHide:true,timeout:20000,maxBuffer:1024*1024});
 const list=stdout.trim()?JSON.parse(stdout):[];return (Array.isArray(list)?list:[list]).some(x=>typeof x==='string'&&path.dirname(x).toLowerCase()===folder.toLowerCase());
}
function runWarehouseInstaller(file,execute=run){return execute(file,['/S','--updated','--force-run'],{windowsHide:true,timeout:180000});}
class WarehouseUpdater{
 constructor({dir,fetcher=fetch,find=discover,isRunning=running,read=installed,install=runWarehouseInstaller,canInstall=()=>true,report=async()=>{}}){Object.assign(this,{dir,fetcher,find,isRunning,read,install,canInstall,report});this.state={status:'waiting'};this.busy=false;}
 async tick(){
  if(this.busy)return;this.busy=true;let app;
  try{
   app=await this.find();if(!app){this.state={status:'not_installed'};return;}
   this.state={status:'checking',version:app.version};const response=await this.fetcher(feed+'?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Не удалось проверить выпуск склада');const text=await response.text();if(text.length>16384)throw Error('Неверный ответ обновлений');const next=metadata(text);
   if(!newer(next.version,app.version)){this.state={status:'current',version:app.version,latest_version:next.version};return;}
   this.state={status:'downloading',version:app.version,latest_version:next.version};fs.mkdirSync(this.dir,{recursive:true});const target=path.join(this.dir,'FastGo-Warehouse-Setup-'+next.version+'-Windows-x64.exe');
   const valid=()=>{if(!fs.existsSync(target)||fs.statSync(target).size!==next.size)return false;return crypto.createHash('sha512').update(fs.readFileSync(target)).digest('base64')===next.sha512;};
   if(!valid()){
    const r=await this.fetcher(next.url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Не удалось загрузить обновление склада');if(r.url&&!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(new URL(r.url).hostname))throw Error('Неверный адрес установщика');
    const temp=target+'.partial',fd=fs.openSync(temp,'w',0o600),hash=crypto.createHash('sha512');let bytes=0;
    try{for await(const chunk of r.body){bytes+=chunk.length;if(bytes>next.size)throw Error('Размер обновления склада не совпал');hash.update(chunk);fs.writeFileSync(fd,chunk);}fs.fsyncSync(fd);if(bytes!==next.size||hash.digest('base64')!==next.sha512)throw Error('Проверка установщика склада не прошла');}catch(error){fs.closeSync(fd);fs.rmSync(temp,{force:true});throw error;}fs.closeSync(fd);fs.renameSync(temp,target);
   }
   // Never close an older warehouse process whose open documents we cannot inspect.
   if(await this.isRunning(app.folder)){this.state={...this.state,status:'waiting_exit',blocking_reason:'Склад открыт. Его собственное обновление ждёт завершения документа и перехода на главную.'};return;}
   if(!await this.canInstall()){this.state={...this.state,status:'ready',blocking_reason:'Завершаем обновление общего приложения'};return;}
   if(await this.isRunning(app.folder))return;
   this.state={...this.state,status:'installing'};await this.report(this.state);await this.install(target);
   const result=this.read(app.folder);if(!result||newer(next.version,result.version))throw Error('Установщик завершился, подтверждение новой версии ещё не получено');
   this.state={status:'current',version:result.version,latest_version:next.version};
  }catch(error){this.state={...this.state,status:'error',error:error.message};}
  finally{this.busy=false;if(app)await this.report(this.state).catch(()=>{});}
 }
}
module.exports={WarehouseUpdater,metadata,newer,discover,installed,running,runWarehouseInstaller};
