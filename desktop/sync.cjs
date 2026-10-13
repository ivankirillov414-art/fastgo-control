const {stable}=require('./store.cjs');
const transient=e=>!e.status||e.status>=500||[408,429].includes(e.status);
function conflictFields(op,remote){if(!['update','contact'].includes(op.action))return [];return Object.keys(op.patch).filter(k=>!['approve','approval_note'].includes(k)&&stable(op.base?.[k])!==stable(remote[k])&&stable(op.patch[k])!==stable(remote[k]));}
class Synchronizer{
 constructor(store,remote,changed=()=>{}){this.store=store;this.remote=remote;this.changed=changed;this.busy=false;this.online=false;this.lastError='';}
 async run(actor){if(this.busy||!actor)return;this.busy=true;try{
  for(const op of this.store.pending(actor)){
   if(['conflict','failed'].includes(op.status)||this.store.pending(actor).some(x=>x.seq<op.seq&&x.record_id===op.record_id))continue;
   try{
    let payload=op.sent;
    if(!payload){
     if(op.action==='create')payload=op.params;
     else{
      const {record:remote}=await this.remote('get',{kind:op.kind,id:op.record_id},actor);this.online=true;
      const fields=conflictFields(op,remote);if(fields.length){this.store.mark(op.seq,'conflict',{error:JSON.stringify({message:'Одни поля изменены на телефоне и ноутбуке',fields,remote})});this.changed();continue;}
      payload=['update','contact'].includes(op.action)?{...op.patch,kind:op.kind,id:op.record_id,revision:remote.revision,request_id:op.request_id}:{...op.params,revision:remote.revision};
      this.store.remember(actor,op.kind,remote);
     }
     this.store.saveSent(op.seq,payload);
    }
    const response=await this.remote(op.action,payload,actor);this.online=true;
    if(op.action==='create'&&response.id!==op.record_id)throw Object.assign(Error('Сервер не сохранил постоянный идентификатор офлайн-карточки'),{status:409});
    this.store.transaction(()=>{this.store.mark(op.seq,'done');if(op.action==='upload'){const oldPath=JSON.parse(this.store.db.prepare('SELECT patch FROM outbox WHERE seq=?').get(op.seq).patch).paths[0];this.store.replacePath(actor,oldPath,response.path);}});
    const data=await this.remote('get',{kind:op.kind,id:op.record_id},actor);this.store.remember(actor,op.kind,data.record);this.store.cacheResponse(actor,'get',{kind:op.kind,id:op.record_id},data);if(op.patch.parts){const c=await this.remote('catalog',{},actor);this.store.cacheResponse(actor,'catalog',{},c);}this.lastError='';this.changed();
   }catch(e){if(transient(e)){this.online=false;this.lastError=e.message;break;}this.store.mark(op.seq,e.status===409?'conflict':'failed',{error:JSON.stringify({message:e.message})});this.changed();}
  }
 }finally{this.busy=false;}}
 async warm(actor){for(const action of ['request_access','me','catalog','legal','overview']){const d=await this.remote(action,{},actor);this.store.cacheResponse(actor,action,{},d);}for(const kind of ['repair','storage']){
  let offset=0;while(true){const page=await this.remote('list',{kind,status:'all',limit:100,offset},actor);this.store.cacheResponse(actor,'list',{kind,status:'all',limit:100,offset},page);
   for(let i=0;i<(page.items||[]).length;i+=4)await Promise.all(page.items.slice(i,i+4).map(async r=>{const d=await this.remote('get',{kind,id:r.id},actor);this.store.cacheResponse(actor,'get',{kind,id:r.id},d);}));
   offset+=page.items.length;if(!page.items.length||offset>=Number(page.count??page.total))break;
  }
 }this.online=true;this.store.backup();this.changed();}
}
module.exports={Synchronizer,conflictFields,transient};
