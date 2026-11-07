// An update may wait on an open document for hours. Backups continue while it
// is merely ready; starting installation and starting a backup are exclusive.
class BackupScheduler{
 constructor({update=()=>null,closed=()=>false,blocked=()=>false,interrupt=()=>{},copy,error=()=>{},now=Date.now}){Object.assign(this,{update,closed,blocked,interrupt,copy,error,now});this.running=false;this.pauseUntil=0;}
 pauseForUpdate(){this.pauseUntil=this.now()+15000;this.interrupt();}
 async tick(){
  if(this.running||this.closed()||this.blocked()||this.now()<this.pauseUntil)return false;
  const update=this.update();
  if(update?.installing||['preparing','installing'].includes(update?.state?.status))return false;
  this.running=true;
  try{await this.copy();return true;}
  catch(error){this.error(error);return false;}
  finally{this.running=false;}
 }
}
module.exports={BackupScheduler};
