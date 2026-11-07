const {DatabaseSync,backup:sqliteBackup}=require('node:sqlite');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const backupFiles=require(fs.existsSync(path.join(__dirname,'warehouse-native','backup-files.cjs'))?'./warehouse-native/backup-files.cjs':'../warehouse-desktop/backup-files.cjs');
const {dayAt,ownFile,unlink,ensureDirectory,syncDirectory,atomicWrite,readJson,fileInfo,FileVerifier,DailyCatalog,verifySQLite,SpaceBudget,SQLITE_BUDGET_BYTES}=backupFiles;
const autoPattern=/^FastGo-auto-\d{12}\.sqlite$/;
const stable=v=>JSON.stringify(v??null);
const invalid=message=>Object.assign(Error(message),{status:400});
const accountFirstName=name=>{const words=String(name||'').trim().split(/\s+/).filter(Boolean),family=w=>/(?:ов|ев|ин|ский|цкий|ова|ева|ина|ская|цкая|ко)$/i.test(w||'');return words.length>=3&&/(?:вич|вна|ична)$/i.test(words[words.length-1])||words.length===2&&family(words[0])&&!family(words[1])?words[1]:words[0]||'Сотрудник';};
const contentKey=v=>JSON.stringify(v??null,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
const linkedRepairParts=rows=>(Array.isArray(rows)?rows:[]).filter(line=>typeof(line?.part_id||line?.id)==='string'&&String(line.part_id||line.id).trim()&&typeof line.quantity!=='boolean'&&Number.isSafeInteger(Number(line.quantity))&&Number(line.quantity)>0);
function repairPartsState(record,current,p){
 const linked=linkedRepairParts(current.parts);
 if(linked.length)return {mode:linked.some(line=>line.tsd_issue_id)?'issued':'legacy'};
 if(p.no_parts===true)return {mode:'none',pending:true};
 if(p.no_parts===false||p.reopen_reason||String(current.assigned_master_id||'')!==String(record.assigned_master_id||'')||record.parts_status?.mode!=='none')return {mode:'pending',pending:true};
 return record.parts_status;
}
const writes=new Set(['create','update','contact','payment','extend','upload','documents','storage_close','storage_delete']);
const final=new Set(['issued','returned','cancelled','deleted']);
const omit=new Set(['request_id','revision','id','kind','desktop_id','auto_assign','tags','step_flow','flow_action','master_comment','waiting_part','waiting_due','payment_qr']);
const normalize=s=>String(s??'').toLowerCase().replace(/кугоо?|куга|kuga|kugo(?!o)/g,'kugoo').replace(/макс/g,'max').replace(/спид/g,'speed').replace(/\s+/g,' ').trim();
class Store{
 constructor(filename,{now=Date.now,writeBackup=atomicWrite,backupFn=sqliteBackup,budgetBytes=SQLITE_BUDGET_BYTES,freeBytes,minFreeBytes}={}){fs.mkdirSync(path.dirname(filename),{recursive:true});this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS cache(actor TEXT,key TEXT,json TEXT,PRIMARY KEY(actor,key));
 CREATE TABLE IF NOT EXISTS records(actor TEXT,kind TEXT,id TEXT,base TEXT,local TEXT,clouded INTEGER DEFAULT 0,PRIMARY KEY(actor,kind,id));
 CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,kind TEXT,record_id TEXT,request_id TEXT,params TEXT,base TEXT,patch TEXT,result TEXT,status TEXT DEFAULT 'queued',error TEXT,sent TEXT,UNIQUE(actor,request_id));
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,json TEXT);
 CREATE TABLE IF NOT EXISTS print_jobs(actor TEXT,key TEXT,kind TEXT,record_id TEXT,state TEXT,error TEXT,created_at TEXT,PRIMARY KEY(actor,key));`);this.filename=filename;this.clock=now;this.backupFn=backupFn;this.backupFolder=path.join(path.dirname(filename),'backups');this.dailyFolder=path.join(this.backupFolder,'daily');this.backupSpace=new SpaceBudget({dir:this.backupFolder,limitBytes:budgetBytes,freeBytes,minFreeBytes,managed:name=>name.startsWith('daily/')||/^FastGo-auto-\d{12}\.sqlite(?:\.json|\.partial(?:-(?:wal|shm))?)?$/.test(name)});this.writeBackup=(target,bytes)=>this.backupSpace.write(target,bytes,writeBackup);this.backupVerifier=new FileVerifier();this.dailyState={status:'waiting',retained_days:[],retained_count:0,budget_bytes:budgetBytes};try{this.dailyState={...this.dailyState,...readJson(path.join(this.dailyFolder,'status.json')),status:'waiting'};}catch{}
  this.dailyCatalog=new DailyCatalog({dir:path.join(this.dailyFolder,'manifests'),write:this.writeBackup,validate:async entry=>{if(entry.kind!=='sqlite'||entry.sqlite?.name!==this.dailyName(entry.day,entry.id)||entry.restored?.integrity!=='ok')throw Error('Повреждён суточный манифест SQLite');await this.backupVerifier.check(ownFile(this.dailyFolder,entry.sqlite.name),entry.sqlite,{signal:this.dailyController?.signal});},remove:entry=>unlink(this.dailyFolder,this.dailyName(entry.day,entry.id))});
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 close(){this.pauseDailyBackup();this.db.close();}
 setting(key,value){if(arguments.length>1){this.db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(key,stable(value));return value;}return JSON.parse(this.db.prepare('SELECT json FROM settings WHERE key=?').get(key)?.json||'null');}
 cache(actor,key,value){if(arguments.length>2){this.db.prepare('INSERT OR REPLACE INTO cache VALUES(?,?,?)').run(actor,key,stable(value));return value;}return JSON.parse(this.db.prepare('SELECT json FROM cache WHERE actor=? AND key=?').get(actor,key)?.json||'null');}
 row(actor,kind,id){return this.db.prepare('SELECT * FROM records WHERE actor=? AND kind=? AND id=?').get(actor,kind,id);}
 record(actor,kind,id){const row=this.row(actor,kind,id);if(!row)throw Object.assign(Error('Эта карточка ещё не загружена на ноутбук. Подключитесь к сети для загрузки.'),{status:404});return JSON.parse(row.local);}
 pending(actor){return this.db.prepare("SELECT * FROM outbox WHERE actor=? AND status NOT IN ('done','discarded') ORDER BY seq").all(actor).map(r=>({...r,params:JSON.parse(r.params),base:JSON.parse(r.base||'null'),patch:JSON.parse(r.patch||'{}'),sent:r.sent?JSON.parse(r.sent):null}));}
 all(actor,kind){return this.db.prepare('SELECT local FROM records WHERE actor=? AND kind=?').all(actor,kind).map(r=>JSON.parse(r.local));}
 homeData(actor){
  const fields=['id','repair_number','storage_number','brand','model','first_name','last_name','middle_name','status','promised_date','planned_return_date','created_at','total_amount','approved_amount','diagnostics_notes'];
  const rows=kind=>this.all(actor,kind).filter(r=>!final.has(r.status)).map(r=>Object.fromEntries(fields.filter(key=>Object.hasOwn(r,key)).map(key=>[key,r[key]])));
  return {repairs:rows('repair'),storage:rows('storage')};
 }
 remember(actor,kind,record){if(!record?.id)return;this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,1) ON CONFLICT(actor,kind,id) DO UPDATE SET base=excluded.base,clouded=1').run(actor,kind,record.id,stable(record),stable(record));this.rebuild(actor,kind,record.id);}
 pruneSnapshot(actor,kind,ids,candidates){const keep=new Set(ids),pending=new Set(this.pending(actor).filter(x=>x.kind===kind).map(x=>x.record_id));let changed=false;for(const row of this.db.prepare('SELECT id FROM records WHERE actor=? AND kind=? AND clouded=1').all(actor,kind)){if(!candidates?.has(row.id)||keep.has(row.id)||pending.has(row.id))continue;this.db.prepare('DELETE FROM records WHERE actor=? AND kind=? AND id=?').run(actor,kind,row.id);this.db.prepare('DELETE FROM cache WHERE actor=? AND key=?').run(actor,'get:'+stable({kind,id:row.id}));changed=true;}return changed;}
 rebuild(actor,kind,id){const row=this.row(actor,kind,id);if(!row)return;let record=JSON.parse(row.base);for(const op of this.pending(actor).filter(x=>x.kind===kind&&x.record_id===id))record=this.apply(record,op.action,op.patch,op.params,this.cache(actor,'me')||{});this.db.prepare('UPDATE records SET local=? WHERE actor=? AND kind=? AND id=?').run(stable(record),actor,kind,id);return record;}
 apply(record,action,patch,p,member={}){let r={...record};
  if(action==='create')return {...record,...patch};
  if(['update','contact'].includes(action)){Object.assign(r,patch);if(action==='update'){const gross=[...(r.works||[]),...(r.parts||[])].reduce((s,x)=>s+Number(x.price||0)*Number(x.quantity||1),0);r.total_amount=r.total_override??Math.max(0,gross-Number(r.discount||0));if(r.total_override!=null)r.discount=Math.max(0,Math.round((gross-r.total_override)*100)/100);r.parts_status=repairPartsState(record,r,p);if(p.step_flow===true){r.step_state={...(record.step_state||{}),mode:'steps',action:p.flow_action,...(p.master_comment!==undefined?{master_comment:p.master_comment}:{}),...(p.waiting_part!==undefined?{waiting_part:p.waiting_part,waiting_due:p.waiting_due}:{}),...(p.flow_action==='complete'?{completion_request_id:p.request_id,completion_at:new Date().toISOString(),completion_master_name:accountFirstName(member.name),payment_qr:p.payment_qr===true,local_pending:true}:{})};}}if(p.approve){r.approved_amount=r.total_amount;r.approval_note=p.approval_note||'';}}
  if(action==='payment')r.paid_amount=Number(r.paid_amount||0)+Number(p.amount);
  if(action==='extend'){r.storage_amount=Number(r.storage_amount||0)+Number(p.months)*1990;r.extension_months=Number(r.extension_months||0)+Number(p.months);r.extension_amount=Number(r.extension_amount||0)+Number(p.months)*1990;const d=new Date(r.planned_return_date+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(p.months));r.planned_return_date=d.toISOString().slice(0,10);}
  if(action==='storage_close'){r.status='returned';r.handover_notes=p.note;r.issued_at=new Date().toISOString();}
  if(action==='storage_delete'){r.status='deleted';r.handover_notes=p.note;}
  if(action==='upload'||action==='documents'){const field=p.slot==='signed'?'signed_document_paths':'fault_photo_paths';r[field]=[...new Set([...(r[field]||[]),...(patch.paths||p.paths||[])])];}
  r.revision=Number(r.revision||0)+1;r.updated_at=new Date().toISOString();return r;
 }
 localWrite(actor,action,p){if(this.cache(actor,'me')?.role==='mechanic'&&action==='payment')throw invalid('Оплаты недоступны мастеру');if(!writes.has(action))throw invalid('Для этого действия требуется интернет. Ремонты и хранение доступны без сети.');return this.transaction(()=>{
  p={...p,request_id:p.request_id||randomUUID()};const old=this.db.prepare('SELECT result FROM outbox WHERE actor=? AND request_id=?').get(actor,p.request_id);if(old)return JSON.parse(old.result);
  const kind=p.kind==='storage'?'storage':'repair';let before,patch={},id=p.id;
  if(action==='create'){
   for(const f of ['first_name','last_name','phone','brand','model'])if(!String(p[f]||'').trim())throw invalid('Заполните '+f);
   id=p.request_id;p.desktop_id=id;const seq=this.db.prepare("SELECT count(*) AS n FROM outbox WHERE actor=? AND action='create'").get(actor).n+1;
   before={id,revision:0};patch={...p,id,revision:1,status:'accepted',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),works:[],parts:[],paid_amount:0,total_amount:0,discount:0,warranty_days:0,approved_amount:null,quality_checked:false,diagnostics_notes:'',handover_notes:'',fault_photo_paths:[],signed_document_paths:[],repair_number:'Л-'+String(seq).padStart(4,'0'),storage_number:'Л-'+String(seq).padStart(4,'0'),storage_amount:(p.storage_tariff==='season'?7990:Number(p.storage_months||1)*1990)+(p.wash?500:0)};
   this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?,0)').run(actor,kind,id,stable(before),stable(patch));
  }else{
   before=this.record(actor,kind,id);if(p.revision!==undefined&&Number(p.revision)!==Number(before.revision))throw Object.assign(Error('Карточка уже изменена в приложении. Обновите её.'),{status:409});
   const authorizedReopen=action==='update'&&['issued','returned','cancelled'].includes(before.status)&&['owner','developer','admin'].includes(this.cache(actor,'me')?.role)&&String(p.reopen_reason||'').trim()&&p.status===(kind==='storage'?'stored':'accepted');
   if(final.has(before.status)&&!['upload','documents'].includes(action)&&!authorizedReopen)throw invalid('Заказ закрыт. Открыть его повторно может администратор с причиной.');
   if(kind==='repair'&&action==='update'){
    if(p.step_flow===true){const member=this.cache(actor,'me'),actions={diagnose:'diagnostics',save_works:(p.works??before.works??[]).length&&before.status!=='waiting_parts'?'repair':before.status,wait_parts:'waiting_parts',save_comment:before.status,complete:'ready',handover:'issued'};if(member?.role==='mechanic'&&!before.assigned_master_id)p.assigned_master_id=actor;if(!Object.hasOwn(actions,p.flow_action))throw invalid('Неизвестное действие ремонта');if(p.flow_action==='diagnose'&&before.status!=='accepted')throw invalid('Диагностика уже начата');if(p.flow_action==='save_works'&&before.status==='accepted')throw invalid('Сначала начните диагностику');if(['ready','issued','cancelled'].includes(before.status)&&p.flow_action!=='handover')throw invalid('Ремонт завершён');if(p.flow_action==='handover'&&member?.role==='mechanic')throw invalid('Оплата и выдача выполняются на кассе');if(p.flow_action==='handover'&&(before.status!=='ready'||Number(before.paid_amount||0)<Number(before.total_amount||0)))throw invalid('Для выдачи нужны готовность и полная оплата');if(p.flow_action==='complete'&&(before.status!=='repair'||!(p.works??before.works??[]).length||p.quality_checked!==true))throw invalid('Добавьте выполненные работы и подтвердите проверку');if(p.flow_action==='wait_parts'&&(!String(p.waiting_part||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(p.waiting_due||'')))throw invalid('Укажите запчасть и дату доставки');p.status=actions[p.flow_action];}

    if(this.cache(actor,'me')?.role==='mechanic'&&p.parts!==undefined&&contentKey(p.parts)!==contentKey(before.parts||[]))throw invalid('Запчасти выдаются только через ТСД; выданные детали изменяются на кассе');
    if(p.parts!==undefined){const available=(before.parts||[]).map(contentKey);if(!Array.isArray(p.parts)||!p.parts.every(line=>{const at=available.indexOf(contentKey(line));if(at<0)return false;available.splice(at,1);return true;}))throw invalid('Запчасти в ремонт выдаются только через ТСД на кассе');}
    const master=String(p.assigned_master_id??before.assigned_master_id??''),member=this.cache(actor,'me'),linked=linkedRepairParts(p.parts??before.parts);
    if(p.no_parts===true&&(linked.length||actor!==master&&member?.role!=='mechanic'&&!['owner','developer'].includes(member?.role)))throw invalid('Отметку «Ремонт без запчастей» ставит мастер ремонта');
    const noParts=p.no_parts===true||!Object.hasOwn(p,'no_parts')&&!p.reopen_reason&&before.parts_status?.mode==='none'&&master===String(before.assigned_master_id||'');
    if(['ready','issued'].includes(p.status||before.status)&&(p.status||before.status)!==before.status&&!linked.length&&!noParts)throw invalid('Выдайте запчасти в этот ремонт на кассе или отметьте «Ремонт без запчастей»');
   }
   if(['update','contact'].includes(action))for(const [key,value] of Object.entries(p))if(!omit.has(key)&&stable(value)!==stable(before[key]))patch[key]=value;
   if(action==='payment'){if(!Number.isFinite(Number(p.amount))||!Number(p.amount))throw invalid('Укажите сумму оплаты');if(!['cash','card','transfer'].includes(p.method))throw invalid('Выберите способ оплаты');}
   if(action==='upload'){const ext=({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf','video/mp4':'.mp4','video/quicktime':'.mov','video/webm':'.webm'})[p.content_type];if(!ext)throw invalid('Неподдерживаемый файл');patch.paths=['desktop:'+p.request_id+ext];}
  }
  const updated=this.apply(before,action,patch,p,this.cache(actor,'me')||{});const result=action==='upload'?{path:patch.paths[0]}:updated;
  this.db.prepare('INSERT INTO outbox(actor,action,kind,record_id,request_id,params,base,patch,result) VALUES(?,?,?,?,?,?,?,?,?)').run(actor,action,kind,id,p.request_id,stable(p),stable(before),stable(patch),stable(result));
  this.db.prepare('UPDATE records SET local=? WHERE actor=? AND kind=? AND id=?').run(stable(updated),actor,kind,id);return result;
 });}
 cacheResponse(actor,action,p,data){const changed=contentKey(this.cache(actor,action+':'+stable(p)))!==contentKey(data);this.cache(actor,action+':'+stable(p),data);if(['me','catalog','legal','request_access'].includes(action))this.cache(actor,action,data);if(action==='get')this.remember(actor,p.kind||'repair',data.record);if(action==='list')for(const r of data.items||[]){const existing=this.row(actor,p.kind||'repair',r.id);if(!existing)this.remember(actor,p.kind||'repair',r);}return changed;}
 read(actor,action,p={}){if(this.cache(actor,'me')?.role==='mechanic'&&['finance','stock','stock_history','stock_receipts','cash_state','sales'].includes(action))throw Error('Касса, склад и оплаты недоступны мастеру');const kind=p.kind==='storage'?'storage':'repair';
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
  return {...this.stats(actor),printPending,printErrors,backup,daily_backup:this.dailyState};
 }
 stats(actor){return {pending:this.pending(actor).filter(x=>!['conflict','failed'].includes(x.status)).length,conflicts:this.conflicts(actor).length,records:this.db.prepare('SELECT count(*) AS n FROM records WHERE actor=?').get(actor).n};}
 dailyName(day,id){if(!backupFiles.validDay(day)||!backupFiles.uuid.test(id))throw Error('Неверное имя суточной копии');return 'FastGo-daily-'+day+'--'+id+'.sqlite';}
 backupEstimate(db=this.db){return Number(db.prepare('PRAGMA page_count').get().page_count)*Number(db.prepare('PRAGMA page_size').get().page_size)+65536;}
 dailyStatus(value){this.dailyState={...this.dailyState,...value};const last=this.dailyState.last_success_day?' Последняя успешная дата: '+this.dailyState.last_success_day+'.':'';this.dailyState.message=(this.dailyState.error||'Локальная SQLite: '+this.dailyState.retained_count+'/7 суточных дат.')+last;try{this.writeBackup(path.join(this.dailyFolder,'status.json'),Buffer.from(JSON.stringify(this.dailyState)));}catch(error){this.dailyState={...this.dailyState,status:'error',error:error.message,message:error.message+last};}return this.dailyState;}
 pauseDailyBackup(){this.dailyController?.abort(Object.assign(Error('Локальная копия продолжится после обновления'),{code:'BACKUP_PAUSED'}));}
 trimAutomatic(anchor,reserveBytes=0){
  if(!fs.existsSync(this.backupFolder))return;
  const names=fs.readdirSync(this.backupFolder).filter(x=>autoPattern.test(x)).sort().reverse(),anchorName=path.basename(anchor);if(!names.includes(anchorName))return;
  const sizes=new Map(names.map(name=>[name,fs.statSync(ownFile(this.backupFolder,name)).size+(fs.existsSync(ownFile(this.backupFolder,name+'.json'))?fs.statSync(ownFile(this.backupFolder,name+'.json')).size:0)])),automatic=[...sizes.values()].reduce((n,x)=>n+x,0),other=this.backupSpace.usage()-automatic,available=Math.max(sizes.get(anchorName),this.backupSpace.limitBytes-other-reserveBytes-65536);
  let used=sizes.get(anchorName),count=1;
  for(const name of names){if(name===anchorName)continue;if(count<192&&used+sizes.get(name)<=available){used+=sizes.get(name);count++;}else{unlink(this.backupFolder,name);unlink(this.backupFolder,name+'.json');}}
 }
 async compactAutomatic(estimate){
  if(estimate>this.backupSpace.limitBytes)throw Object.assign(Error('Локальная база больше бюджета автоматических копий. Прежние копии сохранены.'),{code:'BACKUP_BUDGET'});
  this.backupSpace.checkFree(estimate);if(!fs.existsSync(this.backupFolder))return;
  // Legacy 192-slot buffers are compacted only around an independently verified
  // already successful automatic copy. Daily and manual archives are never evicted.
  for(const name of fs.readdirSync(this.backupFolder).filter(x=>autoPattern.test(x)).sort().reverse()){
   try{const file=ownFile(this.backupFolder,name),meta=readJson(file+'.json');if(meta.integrity!=='ok')continue;await this.backupVerifier.check(file,meta,{signal:this.dailyController?.signal});await verifySQLite(file,{signal:this.dailyController?.signal});this.trimAutomatic(file,estimate);return;}catch(error){if(this.dailyController?.signal.aborted)throw error;}
  }
 }
 async onlineCopy(target){
  const temporary=target+'.partial';let source,lease;
  try{
   ensureDirectory(path.dirname(target));source=new DatabaseSync(this.filename,{readOnly:true});source.exec('BEGIN');source.prepare('SELECT count(*) AS n FROM sqlite_schema').get();
   // The read transaction pins the WAL snapshot: normal writes continue on the
   // working connection and cannot grow this copy beyond the reserved page count.
   const estimate=this.backupEstimate(source);lease=this.backupSpace.reserve(estimate,{file:temporary});await this.backupFn(source,temporary,{rate:100});source.exec('COMMIT');source.close();source=null;
   this.dailyController?.signal.throwIfAborted();fs.chmodSync(temporary,0o600);const handle=await fs.promises.open(temporary,'r+');try{await handle.sync();}finally{await handle.close();}
   const restored=await verifySQLite(temporary,{signal:this.dailyController?.signal}),info=await fileInfo(temporary,{signal:this.dailyController?.signal});if(info.bytes>estimate)throw Error('Размер локальной копии превысил зарезервированное место');
   await fs.promises.rename(temporary,target);syncDirectory(path.dirname(target));return {info:{sha256:info.sha256,bytes:info.bytes},restored};
  }finally{try{if(source){try{source.exec('ROLLBACK');}catch{}source.close();}for(const suffix of ['','-wal','-shm','-journal'])unlink(path.dirname(temporary),path.basename(temporary)+suffix);}finally{lease?.release();}}
 }
 async backupAutomatic(){
  if(this.autoBackupPromise)return this.autoBackupPromise;
  this.autoBackupPromise=(async()=>{const label='auto-'+new Date(Math.floor(this.clock()/900000)*900000).toISOString().replace(/[^0-9]/g,'').slice(0,12),target=ownFile(this.backupFolder,'FastGo-'+label+'.sqlite');if(fs.existsSync(target)){await this.backupVerifier.check(target,readJson(target+'.json'));return target;}const estimate=this.backupEstimate();await this.compactAutomatic(estimate);const {info}=await this.onlineCopy(target);this.writeBackup(target+'.json',Buffer.from(JSON.stringify({created_at:new Date(this.clock()).toISOString(),...info,integrity:'ok'})));this.trimAutomatic(target,estimate);return target;})().finally(()=>{this.autoBackupPromise=null;});return this.autoBackupPromise;
 }
 async backupDaily(){
  if(this.dailyPromise)return this.dailyPromise;this.dailyController=new AbortController();
  this.dailyPromise=(async()=>{
   try{
    let entries=await this.dailyCatalog.list(),day=dayAt(this.clock());
    if(!entries.some(x=>x.day===day)){
     await this.compactAutomatic(this.backupEstimate());const id=randomUUID(),name=this.dailyName(day,id),target=ownFile(this.dailyFolder,name),{info,restored}=await this.onlineCopy(target);
     await this.dailyCatalog.commit({format:2,kind:'sqlite',id,day,completed_at:new Date(this.clock()).toISOString(),sqlite:{name,...info},restored});
    }
    entries=await this.dailyCatalog.rotate();const latest=entries[0];return this.dailyStatus({status:'current',error:'',retained_days:entries.map(x=>x.day),retained_count:entries.length,last_success_day:latest?.day,last_success_at:latest?.completed_at,integrity_verified:true});
   }catch(error){return this.dailyStatus({status:this.dailyController?.signal.aborted?'paused':'error',error:error.message});}
  })().finally(()=>{this.dailyPromise=null;this.dailyController=null;});return this.dailyPromise;
 }
 backup(label){
  const automatic=label===undefined;if(automatic)label='auto-'+new Date(Math.floor(this.clock()/900000)*900000).toISOString().replace(/[^0-9]/g,'').slice(0,12);
  const folder=path.join(path.dirname(this.filename),'backups');fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,'FastGo-'+String(label).replace(/[^a-zA-Z0-9-]/g,'')+'.sqlite');
  if(!fs.existsSync(target)){
   const temporary=target+'.partial';if(fs.existsSync(temporary))unlink(folder,path.basename(temporary));const lease=this.backupSpace.reserve(this.backupEstimate(),{file:temporary,managed:automatic});
   try{this.db.exec("VACUUM INTO '"+temporary.replace(/'/g,"''")+"'");const check=new DatabaseSync(temporary,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Резервная копия локальной базы повреждена');}finally{check.close();}const fd=fs.openSync(temporary,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temporary,target);syncDirectory(folder);}finally{try{unlink(folder,path.basename(temporary));}finally{lease.release();}}
   const sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(target)).digest('hex'),metadata=Buffer.from(JSON.stringify({created_at:new Date(this.clock()).toISOString(),sha256,bytes:fs.statSync(target).size,integrity:'ok'}));
   if(automatic)this.writeBackup(target+'.json',metadata);else{const reservation=this.backupSpace.reserve(metadata.length,{managed:false});try{atomicWrite(target+'.json',metadata);}finally{reservation.release();}}
   if(automatic)this.trimAutomatic(target,this.backupEstimate());
  }
  return target;
 }
}
module.exports={Store,writes,stable};
