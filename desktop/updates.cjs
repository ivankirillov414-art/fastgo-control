// Installation is explicit: never restart during a repair, print or database write.
class Updates{
 constructor({updater,canInstall,prepare,changed=()=>{},installTimeout=30000}){
  this.installTimeout=installTimeout;this.installTimer=null;
  Object.assign(this,{updater,canInstall,prepare,changed});this.state={status:'idle',version:'',progress:0,error:'',immediate:false,waitReason:'',transferred:0,total:0,bytesPerSecond:0};this.checking=false;this.installing=false;
  // Detached Windows launches may inherit a closed stdout pipe. Update status uses events.
  updater.logger=null;
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('checking-for-update',()=>this.set({status:'checking',error:'',waitReason:''}));
  updater.on('update-available',info=>this.set({status:'downloading',version:info.version,error:'',progress:0,waitReason:'',transferred:0,total:0,bytesPerSecond:0}));
  updater.on('download-progress',p=>this.set({status:'downloading',progress:Math.max(0,Math.min(100,Math.round(p.percent)||0)),transferred:p.transferred||0,total:p.total||0,bytesPerSecond:p.bytesPerSecond||0}));
  updater.on('update-not-available',()=>this.set({status:'current',error:'',immediate:false}));
  updater.on('update-downloaded',info=>{this.set({status:'ready',version:info.version,progress:100,error:'',waitReason:''});if(this.state.immediate)void this.tick();});
  updater.on('error',e=>{clearTimeout(this.installTimer);this.installing=false;this.set({status:'error',error:e.message,immediate:false});});
 }
 set(p){if(Object.entries(p).every(([key,value])=>this.state[key]===value))return;Object.assign(this.state,p);this.changed();}
 async check(){if(this.checking||['downloading','ready','preparing','installing'].includes(this.state.status))return;this.checking=true;try{await this.updater.checkForUpdates();}catch(e){this.set({status:'error',error:e.message,immediate:false});}finally{this.checking=false;}}
 async now(){this.set({immediate:true});await this.check();await this.tick();}
 async tick(){if(this.state.status!=='ready'||this.installing)return;this.installing=true;try{
  const permission=await this.canInstall(this.state.immediate);
  if(permission!==true&&permission?.allowed!==true){this.set({waitReason:permission?.reason||'Ожидаем завершения работы приложения'});this.installing=false;return;}
  this.set({status:'preparing',waitReason:''});await this.prepare();this.set({status:'installing'});
  this.installTimer=setTimeout(()=>{if(this.state.status!=='installing')return;this.installing=false;this.set({status:'error',error:'Приложение не завершилось для обновления. Управление восстановлено. Повторите установку.',immediate:false});},this.installTimeout);this.installTimer.unref?.();
  this.updater.quitAndInstall(true,true);
 }catch(e){clearTimeout(this.installTimer);this.installing=false;this.set({status:'error',error:e.message,immediate:false});}}
}
module.exports={Updates};
