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
      const fields=conflictFields(op,remote);if(fields.length){this.store.mark(op.seq,'conflict',{error:JSON.stringify({message:'Одни поля изменены на телефоне и ноутбуке',fields,remote})});this.changed({dataChanged:true});continue;}
      payload=['update','contact'].includes(op.action)?{...op.patch,kind:op.kind,id:op.record_id,revision:remote.revision,request_id:op.request_id}:{...op.params,revision:remote.revision};
      this.store.remember(actor,op.kind,remote);
     }
     this.store.saveSent(op.seq,payload);
    }
    const response=await this.remote(op.action,payload,actor);this.online=true;
    if(op.action==='create'&&response.id!==op.record_id)throw Object.assign(Error('Сервер не сохранил постоянный идентификатор офлайн-карточки'),{status:409});
    this.store.transaction(()=>{this.store.mark(op.seq,'done');if(op.action==='upload'){const oldPath=JSON.parse(this.store.db.prepare('SELECT patch FROM outbox WHERE seq=?').get(op.seq).patch).paths[0];this.store.replacePath(actor,oldPath,response.path);}});
    const data=await this.remote('get',{kind:op.kind,id:op.record_id},actor);this.store.remember(actor,op.kind,data.record);this.store.cacheResponse(actor,'get',{kind:op.kind,id:op.record_id},data);if(op.patch.parts){const c=await this.remote('catalog',{},actor);this.store.cacheResponse(actor,'catalog',{},c);}this.lastError='';this.changed({dataChanged:true});
   }catch(e){if(transient(e)){this.online=false;this.lastError=e.message;break;}this.store.mark(op.seq,e.status===409?'conflict':'failed',{error:JSON.stringify({message:e.message})});this.changed({dataChanged:true});}
  }
 }finally{this.busy=false;}}
 warm(actor,options={}){if(this.warming)return this.warming;this.warming=this.pull(actor,options).finally(()=>{this.warming=null;});return this.warming;}
 async pull(actor,{force=false}={}){
  const previous=this.store.cache(actor,'sync_checkpoint'),day=new Date().toISOString().slice(0,10);
  let status;
  try{status=await this.remote('sync_status',{},actor);}catch(e){if(e.status!==400)throw e;}
  const incremental=status?.protocol===1&&status.incremental===true;
  // Older servers remain usable, without repeatedly downloading their entire database.
  if(!incremental&&!force&&previous?.legacyAt>Date.now()-120000)return;
  const full=!incremental||!previous?.incremental||previous.epoch!==status.epoch||previous.access!==status.access||Number(previous.version)>Number(status.version);
  let manifest={reset:full,records:[],catalog:previous?.catalog!==status?.catalog,overview:previous?.day!==day};
  if(!full&&previous.version!==status.version){
   const delta=await this.remote('sync_changes',{since:previous.version,until:status.version,epoch:status.epoch},actor);
   if(delta.version!==status.version||(!delta.reset&&!Array.isArray(delta.records)))throw Error('Неполный список изменений базы');
   manifest={...delta,catalog:manifest.catalog||delta.catalog,overview:manifest.overview||delta.overview};
  }
  const staged=[],snapshots=new Map();
  const read=async(action,params={})=>{const data=await this.remote(action,params,actor);staged.push({action,params,data});return data;};
  const cards=async targets=>{for(let i=0;i<targets.length;i+=4)await Promise.all(targets.slice(i,i+4).map(p=>read('get',p)));};
  if(manifest.reset){
   await read('request_access');const me=await read('me');await read('catalog');
   if(['developer','owner'].includes(me.role))await read('legal');
   await read('overview');
   for(const kind of ['repair','storage']){
    const ids=[];let offset=0;
    while(true){const page=await read('list',{kind,status:'all',limit:100,offset});
     if(!Array.isArray(page.items)||!Number.isFinite(Number(page.count??page.total)))throw Error('Неполный список карточек');
     await cards(page.items.map(r=>({kind,id:r.id})));ids.push(...page.items.map(r=>r.id));offset+=page.items.length;
     if(offset>=Number(page.count??page.total))break;
     if(!page.items.length)throw Error('Загрузка карточек прервалась');
    }
    snapshots.set(kind,ids);
   }
  }else{
   const targets=new Map(manifest.records.map(r=>[r.kind+':'+r.id,r]));
   // Refresh an old storage link as well when a repair was detached or relinked.
   const repairIds=new Set(manifest.records.filter(r=>r.kind==='repair').map(r=>r.id));
   if(repairIds.size)for(const storage of this.store.all(actor,'storage'))if((this.store.cache(actor,'get:'+stable({kind:'storage',id:storage.id}))?.linked||[]).some(r=>repairIds.has(r.id)))targets.set('storage:'+storage.id,{kind:'storage',id:storage.id});
   await cards([...targets.values()]);
   if(manifest.catalog)await read('catalog');
   if(manifest.overview)await read('overview');
  }
  let dataChanged=false;
  // Commit the cursor only after every read succeeded; retry safely after a dropped connection.
  // The cursor is captured BEFORE reads, so simultaneous phone edits cannot be skipped.
  this.store.transaction(()=>{
   for(const {action,params,data} of staged){if(this.store.cacheResponse(actor,action,params,data))dataChanged=true;if(action==='get'&&data.legal)this.store.cache(actor,'legal',data.legal);}
   for(const [kind,ids] of snapshots)if(this.store.pruneSnapshot(actor,kind,ids))dataChanged=true;
   this.store.cache(actor,'sync_checkpoint',incremental?{...status,day}:{legacyAt:Date.now(),day});
  });
  this.online=true;this.lastError='';if(dataChanged)this.store.backup();this.changed({dataChanged});
 }
}
module.exports={Synchronizer,conflictFields,transient};
