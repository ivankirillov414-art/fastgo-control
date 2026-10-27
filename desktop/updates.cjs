// Installation is explicit: never restart during a repair, print or database write.
function newerVersion(candidate,current){
 const parts=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value)?value.split('.').map(Number):null;
 const next=parts(candidate),old=parts(current);if(!next||!old)return false;
 for(let i=0;i<3;i++)if(next[i]!==old[i])return next[i]>old[i];
 return false;
}
class Updates{
 constructor({updater,canInstall,prepare,changed=()=>{},installTimeout=30000,readyCheckInterval=15*60*1000,progressInterval=250,now=Date.now}){
  this.installTimeout=installTimeout;this.installTimer=null;
  Object.assign(this,{readyCheckInterval,progressInterval});this.clock=now;this.readyCheckedAt=0;this.refreshingReady=false;this.progressTimer=null;this.lastProgressAt=null;
  Object.assign(this,{updater,canInstall,prepare,changed});this.state={status:'idle',version:'',progress:0,error:'',immediate:false,waitReason:'',transferred:0,total:0,bytesPerSecond:0};this.checking=false;this.installing=false;
  // Detached Windows launches may inherit a closed stdout pipe. Update status uses events.
  updater.logger=null;
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('checking-for-update',()=>{if(!this.refreshingReady)this.set({status:'checking',error:'',waitReason:''});});
  updater.on('update-available',info=>{if(this.refreshingReady){this.readyCandidate=info;return;}this.downloading(info);});
  updater.on('download-progress',p=>{if(this.state.status!=='downloading')return;this.set({progress:Math.max(0,Math.min(100,Math.round(p.percent)||0)),transferred:p.transferred||0,total:p.total||0,bytesPerSecond:p.bytesPerSecond||0},true);});
  updater.on('update-not-available',info=>{if(this.refreshingReady){this.readyCandidate=info;return;}this.set({status:'current',error:'',immediate:false});});
  updater.on('update-downloaded',info=>{this.readyCheckedAt=this.clock();this.set({status:'ready',version:info.version,progress:100,error:'',waitReason:''});if(this.state.immediate)void this.tick();});
  updater.on('error',e=>{if(this.refreshingReady){this.readyRefreshError=e;return;}this.fail(e);});
 }
 set(p,progress=false){
  if(Object.entries(p).every(([key,value])=>this.state[key]===value))return;Object.assign(this.state,p);
  if(!progress){clearTimeout(this.progressTimer);this.progressTimer=null;this.lastProgressAt=null;this.changed();return;}
  // State remains current for polling; only the renderer notification is batched.
  const elapsed=this.lastProgressAt===null?Infinity:Math.max(0,this.clock()-this.lastProgressAt);
  if(elapsed>=this.progressInterval){clearTimeout(this.progressTimer);this.progressTimer=null;this.lastProgressAt=this.clock();this.changed();}
  else if(!this.progressTimer){this.progressTimer=setTimeout(()=>{this.progressTimer=null;if(this.state.status!=='downloading')return;this.lastProgressAt=this.clock();this.changed();},this.progressInterval-elapsed);this.progressTimer.unref?.();}
 }
 fail(e){clearTimeout(this.installTimer);this.installing=false;this.set({status:'error',error:e?.message||String(e),immediate:false});}
 downloading(info){this.set({status:'downloading',version:info.version,error:'',progress:0,waitReason:'',transferred:0,total:0,bytesPerSecond:0});}
 readyCheckDue(){return this.state.status==='ready'&&this.clock()-this.readyCheckedAt>=this.readyCheckInterval;}
 async refreshReady(){
  const cachedVersion=this.state.version,autoDownload=this.updater.autoDownload;let result,info;
  this.checking=true;this.refreshingReady=true;this.readyCandidate=null;this.readyRefreshError=null;this.readyCheckedAt=this.clock();
  try{
   // electron-updater 6 supports metadata-only checks. Keep a verified cache
   // installable offline; start a replacement only when the feed is newer.
   this.updater.autoDownload=false;result=await this.updater.checkForUpdates();
   if(this.readyRefreshError)throw this.readyRefreshError;
   info=result?.updateInfo||result?.versionInfo||this.readyCandidate;
  }catch(e){this.set({error:e?.message||String(e)});return;}
  finally{this.updater.autoDownload=autoDownload;this.refreshingReady=false;this.readyCandidate=null;this.readyRefreshError=null;this.checking=false;}
  if(!newerVersion(info?.version,cachedVersion)){this.set({error:''});return;}
  this.downloading(info);
  try{Promise.resolve(this.updater.downloadUpdate(result?.cancellationToken)).catch(e=>this.fail(e));}catch(e){this.fail(e);}
 }
 async check({refreshReady=false}={}){
  if(this.checking||this.installing||['downloading','preparing','installing'].includes(this.state.status))return;
  if(this.state.status==='ready'){if(refreshReady||this.readyCheckDue())await this.refreshReady();return;}
  this.checking=true;try{await this.updater.checkForUpdates();}catch(e){this.fail(e);}finally{this.checking=false;}
 }
 async now(){this.set({immediate:true});await this.check({refreshReady:true});await this.tick();}
 async tick(){
  if(this.state.status!=='ready'||this.installing||this.checking)return;
  if(this.readyCheckDue()){await this.check({refreshReady:true});if(this.state.status!=='ready'||this.installing||this.checking)return;}
  this.installing=true;try{
  const permission=await this.canInstall(this.state.immediate);
  if(permission!==true&&permission?.allowed!==true){this.set({waitReason:permission?.reason||'Ожидаем завершения работы приложения'});this.installing=false;return;}
  this.set({status:'preparing',waitReason:''});await this.prepare();this.set({status:'installing'});
  this.installTimer=setTimeout(()=>{if(this.state.status!=='installing')return;this.installing=false;this.set({status:'error',error:'Приложение не завершилось для обновления. Управление восстановлено. Повторите установку.',immediate:false});},this.installTimeout);this.installTimer.unref?.();
  this.updater.quitAndInstall(true,true);
 }catch(e){clearTimeout(this.installTimer);this.installing=false;this.set({status:'error',error:e.message,immediate:false});}}
}
module.exports={Updates};
