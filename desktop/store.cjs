const {DatabaseSync}=require('node:sqlite');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const stable=v=>JSON.stringify(v??null);
const contentKey=v=>JSON.stringify(v??null,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const writes=new Set(['create','update','contact','payment','extend','upload','documents','storage_close','storage_delete']);
const final=new Set(['issued','returned','cancelled','deleted']);
const omit=new Set(['request_id','revision','id','kind','desktop_id','auto_assign','tags']);
const normalize=s=>String(s??'').toLowerCase().replace(/кугоо?|куга|kuga|kugo(?!o)/g,'kugoo').replace(/макс/g,'max').replace(/спид/g,'speed').replace(/\s+/g,' ').trim();
class Store{
 constructor(filename){fs.mkdirSync(path.dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS cache(actor TEXT,key TEXT,json TEXT,PRIMARY KEY(actor,key));
 CREATE TABLE IF NOT EXISTS records(actor TEXT,kind TEXT,id TEXT,base TEXT,local TEXT,clouded INTEGER DEFAULT 0,PRIMARY KEY(actor,kind,id));
 CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,kind TEXT,record_id TEXT,request_id TEXT,params TEXT,base TEXT,patch TEXT,result TEXT,status TEXT DEFAULT 'queued',error TEXT,sent TEXT,UNIQUE(actor,request_id));
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,json TEXT);
 CREATE TABLE IF NOT EXISTS print_jobs(actor TEXT,key TEXT,kind TEXT,record_id TEXT,state TEXT,error TEXT,created_at TEXT,PRIMARY KEY(actor,key));`);this.filename=filename;}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 close(){this.db.close();}
 setting(key,value){if(arguments.length>1){this.db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(key,stable(value));return value;}return JSON.parse(this.db.prepare('SELECT json FROM settings WHERE key=?').get(key)?.json||'null');}
 cache(actor,key,value){if(arguments.length>2){this.db.prepare('INSERT OR REPLACE INTO cache VALUES(?,?,?)').run(actor,key,stable(value));return value;}return JSON.parse(this.db.prepare('SELECT json FROM cache WHERE actor=? AND key=?').get(actor,key)?.json||'null');}
 row(actor,kind,id){return this.db.prepare('SELECT * FROM records WHERE actor=? AND kind=? AND id=?').get(actor,kind,id);}
 record(actor,kind,id){const row=this.row(actor,kind,id);if(!row)throw Object.assign(Error('Эта карточка ещё не загружена на ноутбук. Подключитесь к сети для загрузки.'),{status:404});return JSON.parse(row.local);}
 pending(actor){return this.db.prepare("SELECT * FROM outbox WHERE actor=? AND status NOT IN ('done','discarded') ORDER BY seq").all(actor).map(r=>({...r,params:JSON.parse(r.params),base:JSON.parse(r.base||'null'),patch:JSON.parse(r.patch||'{}'),sent:r.sent?JSON.parse(r.sent):null}));}
 all(actor,kind){return this.db.prepare('SELECT local FROM records WHERE actor=? AND kind=?').all(actor,kind).map(r=>JSON.parse(r.local));}
 remember(actor,kind,record){if(!record?.id)return;this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,1) ON CONFLICT(actor,kind,id) DO UPDATE SET base=excluded.base,clouded=1').run(actor,kind,record.id,stable(record),stable(record));this.rebuild(actor,kind,record.id);}
 pruneSnapshot(actor,kind,ids,candidates){const keep=new Set(ids),pending=new Set(this.pending(actor).filter(x=>x.kind===kind).map(x=>x.record_id));let changed=false;for(const row of this.db.prepare('SELECT id FROM records WHERE actor=? AND kind=? AND clouded=1').all(actor,kind)){if(!candidates?.has(row.id)||keep.has(row.id)||pending.has(row.id))continue;this.db.prepare('DELETE FROM records WHERE actor=? AND kind=? AND id=?').run(actor,kind,row.id);this.db.prepare('DELETE FROM cache WHERE actor=? AND key=?').run(actor,'get:'+stable({kind,id:row.id}));changed=true;}return changed;}
 rebuild(actor,kind,id){const row=this.row(actor,kind,id);if(!row)return;let record=JSON.parse(row.base);for(const op of this.pending(actor).filter(x=>x.kind===kind&&x.record_id===id))record=this.apply(record,op.action,op.patch,op.params);this.db.prepare('UPDATE records SET local=? WHERE actor=? AND kind=? AND id=?').run(stable(record),actor,kind,id);return record;}
 apply(record,action,patch,p){let r={...record};
  if(action==='create')return {...record,...patch};
  if(['update','contact'].includes(action)){Object.assign(r,patch);if(action==='update')r.total_amount=Math.max(0,[...(r.works||[]),...(r.parts||[])].reduce((s,x)=>s+Number(x.price||0)*Number(x.quantity||1),0)-Number(r.discount||0));if(p.approve){r.approved_amount=r.total_amount;r.approval_note=p.approval_note||'';}}
  if(action==='payment')r.paid_amount=Number(r.paid_amount||0)+Number(p.amount);
  if(action==='extend'){r.storage_amount=Number(r.storage_amount||0)+Number(p.months)*1990;r.extension_months=Number(r.extension_months||0)+Number(p.months);r.extension_amount=Number(r.extension_amount||0)+Number(p.months)*1990;const d=new Date(r.planned_return_date+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(p.months));r.planned_return_date=d.toISOString().slice(0,10);}
  if(action==='storage_close'){r.status='returned';r.handover_notes=p.note;r.issued_at=new Date().toISOString();}
  if(action==='storage_delete'){r.status='deleted';r.handover_notes=p.note;}
  if(action==='upload'||action==='documents'){const field=p.slot==='signed'?'signed_document_paths':'fault_photo_paths';r[field]=[...new Set([...(r[field]||[]),...(patch.paths||p.paths||[])])];}
  r.revision=Number(r.revision||0)+1;r.updated_at=new Date().toISOString();return r;
 }
 localWrite(actor,action,p){if(!writes.has(action))throw Error('Для этого действия требуется интернет. Ремонты и хранение доступны без сети.');return this.transaction(()=>{
  p={...p,request_id:p.request_id||randomUUID()};const old=this.db.prepare('SELECT result FROM outbox WHERE actor=? AND request_id=?').get(actor,p.request_id);if(old)return JSON.parse(old.result);
  const kind=p.kind==='storage'?'storage':'repair';let before,patch={},id=p.id;
  if(action==='create'){
   for(const f of ['first_name','last_name','phone','brand','model'])if(!String(p[f]||'').trim())throw Error('Заполните '+f);
   id=p.request_id;p.desktop_id=id;const seq=this.db.prepare("SELECT count(*) AS n FROM outbox WHERE actor=? AND action='create'").get(actor).n+1;
   before={id,revision:0};patch={...p,id,revision:1,status:'accepted',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),works:[],parts:[],paid_amount:0,total_amount:0,discount:0,warranty_days:0,approved_amount:null,quality_checked:false,diagnostics_notes:'',handover_notes:'',fault_photo_paths:[],signed_document_paths:[],repair_number:'Л-'+String(seq).padStart(4,'0'),storage_number:'Л-'+String(seq).padStart(4,'0'),storage_amount:(p.storage_tariff==='season'?7990:Number(p.storage_months||1)*1990)+(p.wash?500:0)};
   this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,0)').run(actor,kind,id,stable(before),stable(patch));
  }else{
   before=this.record(actor,kind,id);if(p.revision!==undefined&&Number(p.revision)!==Number(before.revision))throw Object.assign(Error('Карточка уже изменена в приложении. Обновите её.'),{status:409});
   if(final.has(before.status)&&!['upload','documents'].includes(action)&&!p.reopen_reason)throw Error('Заказ закрыт. Откройте его повторно перед изменением.');
   if(['update','contact'].includes(action))for(const [key,value] of Object.entries(p))if(!omit.has(key)&&stable(value)!==stable(before[key]))patch[key]=value;
   if(action==='payment'){if(!Number.isFinite(Number(p.amount))||!Number(p.amount))throw Error('Укажите сумму оплаты');if(!['cash','card','transfer'].includes(p.method))throw Error('Выберите способ оплаты');}
   if(action==='upload'){const ext=({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf','video/mp4':'.mp4','video/quicktime':'.mov','video/webm':'.webm'})[p.content_type];if(!ext)throw Error('Неподдерживаемый файл');patch.paths=['desktop:'+p.request_id+ext];}
  }
  const updated=this.apply(before,action,patch,p);const result=action==='upload'?{path:patch.paths[0]}:updated;
  this.db.prepare('INSERT INTO outbox(actor,action,kind,record_id,request_id,params,base,patch,result) VALUES(?,?,?,?,?,?,?,?,?)').run(actor,action,kind,id,p.request_id,stable(p),stable(before),stable(patch),stable(result));
  this.db.prepare('UPDATE records SET local=? WHERE actor=? AND kind=? AND id=?').run(stable(updated),actor,kind,id);return result;
 });}
 cacheResponse(actor,action,p,data){const changed=contentKey(this.cache(actor,action+':'+stable(p)))!==contentKey(data);this.cache(actor,action+':'+stable(p),data);if(['me','catalog','legal','request_access'].includes(action))this.cache(actor,action,data);if(action==='get')this.remember(actor,p.kind||'repair',data.record);if(action==='list')for(const r of data.items||[]){const existing=this.row(actor,p.kind||'repair',r.id);if(!existing)this.remember(actor,p.kind||'repair',r);}return changed;}
 read(actor,action,p={}){const kind=p.kind==='storage'?'storage':'repair';
  if(action==='overview'){const repairs=this.all(actor,'repair'),storage=this.all(actor,'storage'),active=repairs.filter(r=>!final.has(r.status)),held=storage.filter(r=>!final.has(r.status)),today=new Date().toISOString().slice(0,10),week=new Date(Date.now()+7*86400000).toISOString().slice(0,10);return {...this.cache(actor,'overview:'+stable(p)),repairs:active.length,ready:repairs.filter(r=>r.status==='ready').length,overdue:active.filter(r=>r.promised_date&&r.promised_date<today).length,storage:held.length,storage_due:held.filter(r=>r.planned_return_date>=today&&r.planned_return_date<=week).length,debt:[...repairs,...storage].filter(r=>!['cancelled','deleted'].includes(r.status)).reduce((sum,r)=>sum+Math.max(0,Number(r.storage_tariff?r.storage_amount:r.total_amount||0)-Number(r.paid_amount||0)),0),today_payments:this.cache(actor,'overview:'+stable(p))?.today_payments||0,low_stock:(this.cache(actor,'catalog')?.parts||[]).filter(r=>Number(r.quantity)<=2).length};}
  if(['me','catalog','legal','request_access'].includes(action)){const data=this.cache(actor,action);if(!data)throw Error('Для первого входа и загрузки базы нужен интернет.');if(action==='catalog'){const copy=JSON.parse(JSON.stringify(data));for(const op of this.pending(actor).filter(x=>x.action==='update'&&x.patch.parts)){for(const part of copy.parts||[]){const qty=rows=>(rows||[]).filter(x=>x.id===part.id).reduce((n,x)=>n+Number(x.quantity||1),0);part.quantity=Number(part.quantity||0)+qty(op.base?.parts)-qty(op.patch.parts);}}return copy;}return data;}
  if(action==='get'){const record=this.record(actor,kind,p.id),cached=this.cache(actor,'get:'+stable(p));return {...cached,record,legal:this.cache(actor,'legal')||cached?.legal||{},payments:cached?.payments||[],events:cached?.events||[],linked:cached?.linked||[]};}
  if(action==='list'){let rows=this.all(actor,kind).filter(r=>r.status!=='deleted'),q=normalize(p.search);if(q)rows=rows.filter(r=>normalize([r.first_name,r.last_name,r.middle_name,r.phone,r.brand,r.model,r.serial_number].join(' ')).includes(q));if(!p.status||p.status==='active')rows=rows.filter(r=>!final.has(r.status));else if(p.status!=='all')rows=rows.filter(r=>r.status===p.status);rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));const offset=Number(p.offset)||0,limit=Number(p.limit)||50;return {items:rows.slice(offset,offset+limit),count:rows.length,total:rows.length,offset,limit};}
  if(action==='customers'){const grouped=new Map();for(const r of [...this.all(actor,'repair'),...this.all(actor,'storage')]){if(!grouped.has(r.phone))grouped.set(r.phone,{phone:r.phone,full_name:[r.last_name,r.first_name,r.middle_name].filter(Boolean).join(' '),vehicles:[],orders:0,debt:0,last_visit:r.created_at});const x=grouped.get(r.phone);x.orders++;x.debt+=(r.total_amount||r.storage_amount||0)-(r.paid_amount||0);x.vehicles.push([r.brand,r.model].join(' '));}let items=[...grouped.values()];if(p.search)items=items.filter(x=>normalize(x.full_name+' '+x.phone).includes(normalize(p.search)));return {items,count:items.length,total:items.length};}
  if(action==='signed_url'||action==='get_url'){if(String(p.path).startsWith('desktop:')){const op=this.db.prepare("SELECT params FROM outbox WHERE actor=? AND action='upload' AND patch LIKE ?").get(actor,'%'+p.path+'%');if(op){const data=JSON.parse(op.params);return {url:'data:'+data.content_type+';base64,'+data.content_base64};}}}
  const data=this.cache(actor,action+':'+stable(p));if(data===null)throw Error('Этот раздел ещё не загружен. При первом запуске подключитесь к интернету.');return data;
 }
 mark(seq,status,extra={}){const sets=['status=?'],args=[status];for(const k of ['error','sent'])if(k in extra){sets.push(k+'=?');args.push(k==='sent'?stable(extra[k]):extra[k]);}args.push(seq);this.db.prepare('UPDATE outbox SET '+sets.join(',')+' WHERE seq=?').run(...args);}
 saveSent(seq,payload){this.db.prepare('UPDATE outbox SET sent=? WHERE seq=?').run(stable(payload),seq);}
 replacePath(actor,oldPath,newPath){for(const table of ['records','outbox','cache']){const columns=table==='records'?['base','local']:table==='outbox'?['params','patch']:['json'];for(const column of columns)this.db.prepare('UPDATE '+table+' SET '+column+'=replace('+column+',?,?) WHERE actor=?').run(oldPath,newPath,actor);}}
 conflicts(actor){return this.pending(actor).filter(x=>x.status==='conflict'||x.status==='failed');}
 resolve(actor,seq,choice,remote){const op=this.pending(actor).find(x=>x.seq===seq);if(!op||!['conflict','failed'].includes(op.status))throw Error('Конфликт уже изменён');if(choice==='remote')this.mark(seq,'discarded',{error:'Выбрана серверная версия'});else if(choice==='local'){if(op.action==='create')throw Error('Создание не может перезаписать другую карточку');this.db.prepare("UPDATE outbox SET status='queued',base=?,sent=NULL,error=NULL WHERE seq=? AND actor=?").run(stable(remote),seq,actor);}else throw Error('Выберите версию');if(remote)this.remember(actor,op.kind,remote);this.rebuild(actor,op.kind,op.record_id);}
 printState(actor,key,state,kind,id,error){this.db.prepare('INSERT INTO print_jobs VALUES(?,?,?,?,?,?,?) ON CONFLICT(actor,key) DO UPDATE SET state=excluded.state,error=excluded.error').run(actor,key,kind,id,state,error||null,new Date().toISOString());}
 printExists(actor,key){return this.db.prepare('SELECT state FROM print_jobs WHERE actor=? AND key=?').get(actor,key);}
 diagnostics(actor){
  const printPending=this.db.prepare("SELECT count(*) AS n FROM print_jobs WHERE actor=? AND state='queued'").get(actor).n;
  const printErrors=this.db.prepare("SELECT kind,record_id,state,error,created_at FROM print_jobs WHERE actor=? AND state IN ('failed','dispatched') ORDER BY created_at DESC LIMIT 10").all(actor);
  const folder=path.join(path.dirname(this.filename),'backups');let backup=null;
  if(fs.existsSync(folder))for(const name of fs.readdirSync(folder).filter(n=>n.endsWith('.sqlite'))){const stat=fs.statSync(path.join(folder,name));if(!backup||stat.mtimeMs>backup.time)backup={name,time:stat.mtimeMs,bytes:stat.size};}
  return {...this.stats(actor),printPending,printErrors,backup};
 }
 stats(actor){return {pending:this.pending(actor).filter(x=>!['conflict','failed'].includes(x.status)).length,conflicts:this.conflicts(actor).length,records:this.db.prepare('SELECT count(*) AS n FROM records WHERE actor=?').get(actor).n};}
 backup(label=new Date().toISOString().slice(0,10)){const folder=path.join(path.dirname(this.filename),'backups');fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,'FastGo-'+String(label).replace(/[^a-zA-Z0-9-]/g,'')+'.sqlite');if(!fs.existsSync(target))this.db.exec("VACUUM INTO '"+target.replace(/'/g,"''")+"'");return target;}
}
module.exports={Store,writes,stable};
