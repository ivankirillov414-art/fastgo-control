// Installation is explicit: never restart during a repair, print or database write.
class Updates{
 constructor({updater,canInstall,prepare,changed=()=>{}}){
  Object.assign(this,{updater,canInstall,prepare,changed});this.state={status:'idle',version:'',progress:0,error:''};this.checking=false;this.installing=false;
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('checking-for-update',()=>this.set({status:'checking',error:''}));
  updater.on('update-available',info=>this.set({status:'downloading',version:info.version,error:''}));
  updater.on('download-progress',p=>this.set({status:'downloading',progress:Math.round(p.percent)}));
  updater.on('update-not-available',()=>this.set({status:'current',error:''}));
  updater.on('update-downloaded',info=>this.set({status:'ready',version:info.version,progress:100,error:''}));
  updater.on('error',e=>{this.installing=false;this.set({status:'error',error:e.message});});
 }
 set(p){Object.assign(this.state,p);this.changed();}
 async check(){if(this.checking||['downloading','ready','installing'].includes(this.state.status))return;this.checking=true;try{await this.updater.checkForUpdates();}catch(e){this.set({status:'error',error:e.message});}finally{this.checking=false;}}
 async tick(){if(this.state.status!=='ready'||this.installing)return;this.installing=true;try{
  if(!await this.canInstall()){this.installing=false;return;}
  this.prepare();this.set({status:'installing'});this.updater.quitAndInstall(true,true);
 }catch(e){this.installing=false;this.set({status:'error',error:e.message});}}
}
module.exports={Updates};
