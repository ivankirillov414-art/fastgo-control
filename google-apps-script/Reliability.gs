// All business writes use one atomic Sheets batch. A durable intent fences later
// requests after an uncertain HTTP response; never resend a live in-flight batch.
const RELIABLE_VERSION = 'workshop-reliability-2026-09-12';
const OP_SHEET = 'Операции API';
const PHOTO_SHEET = 'Фото товаров';
const OP_HEADERS = ['request_id','actor_id','action','fingerprint','result','created_at'];
const PHOTO_HEADERS = ['photo_id','product_id','category','path','created_at','sha256'];
const MUTATIONS = new Set(['create','update','payment','documents','contact','extend','stock','sale','part_save','part_photo_upload','part_photo_primary','catalog_save','legal_save','upload','migrate_legacy_file']);
let TX = null;

function stable_(v){
  if(Array.isArray(v)) return '['+v.map(stable_).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable_(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function digest_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function fingerprint_(action,p){
  if(/^[0-9a-f]{64}$/.test(p.__request_fingerprint||''))return p.__request_fingerprint;
  const v=JSON.parse(JSON.stringify(p)); delete v.request_id;
  // Price comes from the catalogue inside the lock, never from the browser.
  if(action==='sale')v.items=(v.items||[]).map(x=>({part_id:x.part_id||x.id,quantity:Number(x.quantity)}));
  return digest_(stable_({action,params:v}));
}
function operationStatus_(p,actor){
  const r=find_(OP_SHEET,'request_id',p.request_id);
  if(!r)return {status:'not_found'};
  if(String(r.actor_id)!==String(actor.id))throw httpError_('Чужая операция',403);
  return {status:'committed',action:r.action,result:JSON.parse(r.result)};
}
function reliableRoute_(action,p,actor){
  if(!actor.id||!['owner','admin','receiver','manager','mechanic'].includes(actor.role))throw httpError_('Нет доступа',403);
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    ROW_CACHE={};TX=null;
    if(action==='health')return health_();
    if(PropertiesService.getScriptProperties().getProperty('FASTGO_RELIABILITY_READY')!==RELIABLE_VERSION)throw httpError_('Выполните installReliability в Apps Script',503);
    recoverIntent_();
    if(action==='operation_retry'){const old=find_(OP_SHEET,'request_id',p.request_id);if(!old)return {status:'not_found'};if(old.actor_id!==actor.id||old.action!==p.action||old.fingerprint!==p.fingerprint)throw httpError_('Код уже использован для другой операции',409);return {status:'committed',result:JSON.parse(old.result)};}
    if(!MUTATIONS.has(action))return routeUnlocked_(action,p,actor);
    const requestId=String(p.request_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(requestId))throw httpError_('Нужен постоянный код операции',400);
    const fingerprint=fingerprint_(action,p),old=find_(OP_SHEET,'request_id',requestId);
    if(old){
      if(old.actor_id!==actor.id||old.action!==action||old.fingerprint!==fingerprint)throw httpError_('Код уже использован для другой операции',409);
      return JSON.parse(old.result);
    }
    TX={rows:{}};
    const result=routeUnlocked_(action,p,actor),encoded=JSON.stringify(result);
    if(encoded.length>45000)throw httpError_('Результат слишком велик',413);
    append_(OP_SHEET,{request_id:requestId,actor_id:actor.id,action,fingerprint,result:encoded,created_at:now_()});
    const requests=buildRequests_();TX=null;
    const journal=journalFolder_().createFile(Utilities.newBlob(JSON.stringify({requestId,requests,attemptedAt:Date.now()}),'application/json','intent-'+requestId+'.json'));
    assertPrivate_(journal);
    PropertiesService.getScriptProperties().setProperty('FASTGO_PENDING_INTENT',journal.getId());
    sendIntent_(journal);
    return result;
  }finally{TX=null;ROW_CACHE={};lock.releaseLock();}
}
function stagedAppend_(name,obj){
  if(!TX)throw httpError_('Запись вне транзакции запрещена',500);
  const rows=rows_(name),h=headers_(name),row=Math.max(sh_(name).getLastRow(),...rows.map(x=>x.__row),1)+1;
  const next=Object.fromEntries(h.map(k=>[k,obj[k]===undefined?'':obj[k]]));next.__row=row;
  rows.push(next);stage_(name,row,obj);return next;
}
function stagedPatch_(name,row,obj){
  if(!TX)throw httpError_('Запись вне транзакции запрещена',500);
  const current=rows_(name).find(x=>x.__row===row);if(!current)throw httpError_('Строка не найдена',409);
  Object.assign(current,obj);stage_(name,row,obj);return current;
}
function stage_(name,row,obj){
  const h=headers_(name),changes={};
  for(const k of Object.keys(obj)){if(k==='__row')continue;if(!h.includes(k))throw httpError_('Нет столбца '+name+': '+k,503);if(obj[k]!==undefined)changes[k]=obj[k];}
  const id=name+'\n'+row;TX.rows[id]={name,row,values:{...(TX.rows[id]?.values||{}),...changes}};
}
function cell_(value){
  if(value===null||value===undefined||value==='')return {};
  if(typeof value==='number'){if(!Number.isFinite(value))throw httpError_('Неверное число',400);return {userEnteredValue:{numberValue:value}};}
  if(typeof value==='boolean')return {userEnteredValue:{boolValue:value}};
  return {userEnteredValue:{stringValue:value instanceof Date?value.toISOString():String(value)}};
}
function buildRequests_(){
  const reqs=[],growth={};
  for(const c of Object.values(TX.rows)){
    const sheet=sh_(c.name),h=headers_(c.name),id=sheet.getSheetId();
    if(c.row>sheet.getMaxRows())growth[id]=Math.max(growth[id]||0,c.row);
    // Update only named cells: preserve unrelated formula cells and formatting.
    for(const [key,value] of Object.entries(c.values))reqs.push({updateCells:{start:{sheetId:id,rowIndex:c.row-1,columnIndex:h.indexOf(key)},rows:[{values:[cell_(value)]}],fields:'userEnteredValue'}});
  }
  for(const [id,count] of Object.entries(growth))reqs.unshift({updateSheetProperties:{properties:{sheetId:Number(id),gridProperties:{rowCount:count+100}},fields:'gridProperties.rowCount'}});
  if(JSON.stringify(reqs).length>1800000)throw httpError_('Слишком большая операция. Уменьшите число позиций.',413);
  return reqs;
}
function journalFolder_(){return DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FASTGO_JOURNAL_FOLDER'));}
function sendIntent_(file){
  const intent=JSON.parse(file.getBlob().getDataAsString());
  intent.attemptedAt=Date.now();file.setContent(JSON.stringify(intent));
  const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+FASTGO_SPREADSHEET_ID+':batchUpdate',{
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:intent.requests}),muteHttpExceptions:true
  });
  if(response.getResponseCode()<200||response.getResponseCode()>=300)throw httpError_('Google не подтвердил запись. Операция сохранена для восстановления.',503);
  PropertiesService.getScriptProperties().deleteProperty('FASTGO_PENDING_INTENT');
  // Committed journal is retained for audit and recovery; no source data deletion.
  ROW_CACHE={};
}
function recoverIntent_(){
  const prop=PropertiesService.getScriptProperties(),id=prop.getProperty('FASTGO_PENDING_INTENT');if(!id)return;
  const file=DriveApp.getFileById(id),intent=JSON.parse(file.getBlob().getDataAsString());
  // The receipt is in the same atomic batch as the stock and sale.
  if(find_(OP_SHEET,'request_id',intent.requestId)){prop.deleteProperty('FASTGO_PENDING_INTENT');return;}
  // Sheets processing has a documented 180 s limit. A 300 s fence prevents a
  // late original HTTP request from overwriting a later operation.
  if(Date.now()-intent.attemptedAt<300000)throw httpError_('Проверяется незавершённая операция. Повторите через несколько минут.',503);
  sendIntent_(file);
}
function health_(){const p=PropertiesService.getScriptProperties();return {ok:true,backend:'GOOGLE_SHEETS_DRIVE',release:RELIABLE_VERSION,capabilities:{atomic_writes:p.getProperty('FASTGO_RELIABILITY_READY')===RELIABLE_VERSION,private_product_photos:p.getProperty('FASTGO_RELIABILITY_READY')===RELIABLE_VERSION},pending_recovery:!!p.getProperty('FASTGO_PENDING_INTENT')};}

function assertOpen_(r,kind){if(['issued','returned','cancelled'].includes(normStatus_(r['Статус'],kind)))throw httpError_('Заказ закрыт',409);}
function validateOrderUpdate_(p,actor){
  const kind=p.kind==='storage'?'storage':'repair',r=find_(kind==='storage'?SHEETS.storage:SHEETS.repairs,kind==='storage'?'storage_id':'repair_id',p.id);
  if(!r)throw httpError_('Заказ не найден',404);requireOrderAccess_(actor,kind,r);assertRevision_(r,p);
  const before=normStatus_(r['Статус'],kind),status=p.status||before,closed=['issued','returned','cancelled'];
  if(closed.includes(before)&&!(role_(actor)==='owner'||role_(actor)==='admin')||closed.includes(before)&&(!String(p.reopen_reason||'').trim()||status!==(kind==='storage'?'stored':'accepted')))throw httpError_('Закрытый заказ может открыть администратор с причиной',409);
  if(kind==='storage'){
    if(!['accepted','stored','ready_return','returned','cancelled'].includes(status))throw httpError_('Неверный статус',400);
    if(status==='returned'&&(before!=='ready_return'||num_(r['Оплачено'])<num_(r['Сумма'])||rows_(SHEETS.repairs).some(x=>x.storage_id===p.id&&!closed.includes(normStatus_(x['Статус'],'repair')))))throw httpError_('Для выдачи нужны готовность, полная оплата и завершённые ремонты',409);
    return;
  }
  if(!['accepted','diagnostics','waiting_parts','repair','ready','issued','cancelled'].includes(status))throw httpError_('Неверный статус',400);
  const works=p.works||parseJson_(r['Работы'],[]),parts=p.parts||parseJson_(r['Строки запчастей'],[]);
  for(const line of [...works,...parts])if(!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1||!Number.isFinite(Number(line.price))||Number(line.price)<0)throw httpError_('Проверьте количество и цену',400);
  const discount=num_(p.discount===undefined?r['Скидка']:p.discount),amount=[...works,...parts].reduce((s,x)=>s+Number(x.price)*Number(x.quantity),0)-discount;
  if(amount<0||discount<0)throw httpError_('Неверная скидка',400);
  if(!isManager_(actor)&&(p.approve||discount!==num_(r['Скидка'])))throw httpError_('Нет права согласования или скидки',403);
  if(p.approve&&!String(p.approval_note||'').trim())throw httpError_('Укажите согласование',400);
  const approved=p.approve?amount:r['Согласовано, ₽'],quality=p.quality_checked===undefined?bool_(r['Контроль качества']):bool_(p.quality_checked);
  if(['ready','issued'].includes(status)&&(!quality||approved===''||approved===null||num_(approved)!==amount))throw httpError_('Нужны согласование стоимости и контроль качества',409);
  if(status==='issued'&&(before!=='ready'||num_(r['Оплачено'])<amount))throw httpError_('Для выдачи нужны готовность и полная оплата',409);
}

function assertPrivate_(file){
  file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw httpError_('Не удалось ограничить доступ к файлу',503);
}
function imageBytes_(p){
  if(!['image/jpeg','image/png','image/webp'].includes(p.content_type))throw httpError_('Поддерживаются JPG, PNG, WebP',400);
  const b=Utilities.base64Decode(String(p.content_base64||'')),u=b.map(x=>(x+256)%256),m=p.content_type;
  if(!b.length||b.length>5*1024*1024)throw httpError_('Размер фотографии: от 1 байта до 5 МБ',413);
  if(!(m==='image/jpeg'&&u[0]===255&&u[1]===216&&u[2]===255||m==='image/png'&&u.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'||m==='image/webp'&&String.fromCharCode(...u.slice(0,4))==='RIFF'&&String.fromCharCode(...u.slice(8,12))==='WEBP'))throw httpError_('Содержимое не соответствует формату изображения',400);
  return b;
}
function privatePartUpload_(p){
  const product=find_(SHEETS.products,'product_id',p.part_id);if(!product)throw httpError_('Товар не найден',404);
  const bytes=imageBytes_(p),folder=DriveApp.getFolderById(String(setting_('products_photo_folder_id')));assertPrivate_(folder);
  const file=folder.createFile(Utilities.newBlob(bytes,p.content_type,p.part_id+'-'+uid_()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[p.content_type]));assertPrivate_(file);
  append_(PHOTO_SHEET,{photo_id:file.getId(),product_id:p.part_id,category:product['Категория'],path:file.getUrl(),created_at:now_(),sha256:digest_(bytes)});
  return partPhotoPrimary_({...p,photo_id:file.getId()});
}
function partPhotoPrimary_(p){
  const r=find_(SHEETS.products,'product_id',p.part_id),photo=find_(PHOTO_SHEET,'photo_id',p.photo_id);
  if(!r||!photo||photo.product_id!==p.part_id)throw httpError_('Фото не относится к товару',403);
  patchRow_(SHEETS.products,r.__row,{'Фото URL':photo.path,updated_at:now_()});
  if(bool_(p.primary_for_category)){
    const cat=find_(SHEETS.categories,'Категория (ключ)',r['Категория']);if(!cat)throw httpError_('Категория не найдена',404);
    patchRow_(SHEETS.categories,cat.__row,{'Основное фото':photo.path});
  }
  return {path:photo.path,photo_id:photo.photo_id};
}
function partPhotos_(p){const product=find_(SHEETS.products,'product_id',p.part_id);if(!product)throw httpError_('Товар не найден',404);return rows_(PHOTO_SHEET).filter(x=>x.product_id===p.part_id).map(x=>({id:x.photo_id,path:x.path,primary:x.path===product['Фото URL']}));}
function privatePartPhoto_(p){
  let path='';
  if(p.category){const c=find_(SHEETS.categories,'Категория (ключ)',p.category);path=c?.['Основное фото']||'';if(!rows_(PHOTO_SHEET).some(x=>x.path===path&&x.category===p.category))throw httpError_('Фото категории не найдено',404);}
  else{const product=find_(SHEETS.products,'product_id',p.part_id),photos=partPhotos_(p);path=p.photo_id?photos.find(x=>x.id===p.photo_id)?.path:product?.['Фото URL'];if(!photos.some(x=>x.path===path))throw httpError_('Фото товара не найдено',404);}
  const file=DriveApp.getFileById(driveFileId_(path)),blob=file.getBlob();if(blob.getBytes().length>5*1024*1024)throw httpError_('Файл слишком большой',413);
  return {url:'data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes())};
}

function migrationManifest_(actor){requireAdmin_(actor);return rows_(SHEETS.files).filter(x=>String(x['Исходный путь']).startsWith('storage/')).map(x=>({object_id:x.object_id,path:x['Исходный путь'],size:Number(x['Размер, байт']),migrated:!!x['Google Drive URL'],record_id:x.record_id||null}));}
function migrateLegacy_(p,actor){
  requireAdmin_(actor);const row=find_(SHEETS.files,'object_id',p.object_id);if(!row||!String(row['Исходный путь']).startsWith('storage/'))throw httpError_('Исходный файл не найден',404);
  if(row['Google Drive URL'])return {object_id:row.object_id,migrated:true,path:row['Google Drive URL']};
  const bytes=Utilities.base64Decode(String(p.content_base64||'')),hash=digest_(bytes);
  if(bytes.length!==Number(row['Размер, байт'])||hash!==p.sha256)throw httpError_('Контрольная сумма исходного файла не совпала',409);
  let folderId=String(setting_('documents_folder_id'));
  if(row.record_id){const rec=find_(SHEETS.storage,'storage_id',row.record_id)||find_(SHEETS.repairs,'repair_id',row.record_id);if(!rec)throw httpError_('Связанная приёмка не найдена',409);const intake=find_(SHEETS.intakes,'intake_id',rec.intake_id)||{};const m=String(rec['Папка фото']||intake['Папка фото']||'').match(/folders\/([^/?]+)/);if(m)folderId=m[1];}
  const folder=DriveApp.getFolderById(folderId);assertPrivate_(folder);
  const f=folder.createFile(Utilities.newBlob(bytes,p.content_type||'image/jpeg','legacy-'+row.object_id+'.jpg'));assertPrivate_(f);
  if(digest_(f.getBlob().getBytes())!==hash)throw httpError_('Проверка копии в Drive не пройдена',503);
  patchRow_(SHEETS.files,row.__row,{'Google Drive URL':f.getUrl(),'Статус миграции':'Скопировано и проверено','Примечание':'SHA256 '+hash+'; исходник сохранён',updated_at:now_()});
  return {object_id:row.object_id,migrated:true,path:f.getUrl(),size:bytes.length,sha256:hash};
}

function ensureSheet_(name,headers){let s=ss_().getSheetByName(name);if(!s){s=ss_().insertSheet(name);s.getRange(1,1,1,headers.length).setValues([headers]);s.setFrozenRows(1);}if(s.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw Error('Проверьте заголовки '+name);}
function installReliability(){
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    ROW_CACHE={};ensureSheet_(OP_SHEET,OP_HEADERS);ensureSheet_(PHOTO_SHEET,PHOTO_HEADERS);
    const props=PropertiesService.getScriptProperties();
    if(!props.getProperty('FASTGO_JOURNAL_FOLDER')){const root=DriveApp.getFolderById(String(setting_('backups_folder_id')));assertPrivate_(root);const folder=root.createFolder('Журнал операций FastGo');assertPrivate_(folder);props.setProperty('FASTGO_JOURNAL_FOLDER',folder.getId());}
    // Verify Sheets API permission before enabling writes.
    const r=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+FASTGO_SPREADSHEET_ID+'?fields=spreadsheetId',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    if(r.getResponseCode()!==200)throw Error('Нужен доступ к Google Sheets API');
    props.setProperty('FASTGO_RELIABILITY_READY',RELIABLE_VERSION);
  }finally{lock.releaseLock();}
  installDailyBackupTrigger();const backup=dailyBackup(),restore=verifyBackupRestore();return {release:RELIABLE_VERSION,backup,restore};
}
function backupStatus_(){const p=PropertiesService.getScriptProperties();return {trigger_count:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='dailyBackup').length,last_success:p.getProperty('FASTGO_BACKUP_LAST_SUCCESS'),last_backup_id:p.getProperty('FASTGO_BACKUP_LAST_ID'),restore_verified_at:p.getProperty('FASTGO_RESTORE_VERIFIED_AT'),last_error:p.getProperty('FASTGO_BACKUP_LAST_ERROR')};}
function installDailyBackupTrigger(){
  const props=PropertiesService.getScriptProperties(),current=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='dailyBackup');
  if(current.length===1&&props.getProperty('FASTGO_BACKUP_SCHEDULE')==='03:00 Asia/Yekaterinburg')return backupStatus_();
  // Create first: if creation fails, retain the previous schedule.
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).inTimezone('Asia/Yekaterinburg').create();
  current.forEach(t=>ScriptApp.deleteTrigger(t));props.setProperty('FASTGO_BACKUP_SCHEDULE','03:00 Asia/Yekaterinburg');return backupStatus_();
}
function workbookDigest_(book){return digest_(JSON.stringify(book.getSheets().map(s=>({name:s.getName(),values:s.getDataRange().getValues(),formulas:s.getDataRange().getFormulas()}))));}
function dailyBackup(){
  const lock=LockService.getScriptLock();lock.waitLock(25000);const props=PropertiesService.getScriptProperties();
  try{
    ROW_CACHE={};recoverIntent_();SpreadsheetApp.flush();
    const folder=DriveApp.getFolderById(String(setting_('backups_folder_id')));assertPrivate_(folder);
    const expected=workbookDigest_(ss_()),copy=DriveApp.getFileById(FASTGO_SPREADSHEET_ID).makeCopy('FastGo — проверенная копия — '+now_(),folder);assertPrivate_(copy);
    if(workbookDigest_(SpreadsheetApp.openById(copy.getId()))!==expected)throw Error('Проверка копии не пройдена');
    props.setProperties({FASTGO_BACKUP_LAST_SUCCESS:now_(),FASTGO_BACKUP_LAST_ID:copy.getId(),FASTGO_BACKUP_LAST_ERROR:''});
    return {id:copy.getId(),verified:true};
  }catch(e){props.setProperty('FASTGO_BACKUP_LAST_ERROR',String(e.message).slice(0,500));throw e;}finally{lock.releaseLock();}
}
function verifyBackupRestore(){
  const props=PropertiesService.getScriptProperties(),id=props.getProperty('FASTGO_BACKUP_LAST_ID');if(!id)throw Error('Сначала выполните dailyBackup');
  const source=SpreadsheetApp.openById(id),folder=DriveApp.getFolderById(String(setting_('backups_folder_id'))),copy=DriveApp.getFileById(id).makeCopy('FastGo — проверка восстановления — '+now_(),folder);assertPrivate_(copy);
  const restored=SpreadsheetApp.openById(copy.getId());if(workbookDigest_(restored)!==workbookDigest_(source))throw Error('Восстановленные данные отличаются');
  props.setProperty('FASTGO_RESTORE_VERIFIED_AT',now_());return {restored_spreadsheet_id:copy.getId(),verified:true,production_unchanged:true};
}
