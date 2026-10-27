// An update may wait on an open document for hours. Backups continue while it
// is merely ready; starting installation and starting a backup are exclusive.
class BackupScheduler{
 constructor({update=()=>null,closed=()=>false,copy,error=()=>{}}){Object.assign(this,{update,closed,copy,error});this.running=false;}
 async tick(){
  if(this.running||this.closed())return false;
  const update=this.update();
  if(update?.installing||['preparing','installing'].includes(update?.state?.status))return false;
  this.running=true;
  try{await this.copy();return true;}
  catch(error){this.error(error);return false;}
  finally{this.running=false;}
 }
}
module.exports={BackupScheduler};
