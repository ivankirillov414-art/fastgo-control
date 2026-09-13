// Google is a replica. All operational writes are committed in Postgres first.
const FASTGO_NATIVE_SYNC_URL='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-google-mirror';
function nativeSyncRequest_(action,params){
 const response=UrlFetchApp.fetch(FASTGO_NATIVE_SYNC_URL,{method:'post',contentType:'application/json',headers:{'x-fastgo-sync-key':PropertiesService.getScriptProperties().getProperty('FASTGO_API_SECRET')},payload:JSON.stringify({action,params:params||{}}),muteHttpExceptions:true});
 let result;try{result=JSON.parse(response.getContentText());}catch(e){throw Error('Сервис синхронизации не ответил');}
 if(response.getResponseCode()!==200||result.error)throw Error(result.error||'Синхронизация временно недоступна');return result.data;
}
function nativeSnapshot_(){
 const names=['Фото товаров','Операции API','Категории','Товары','Клиенты','Приёмки','Ремонты','Зимнее хранение','Движения склада','Продажи','Строки продаж','Сотрудники','Настройки','Прайс работ','Реквизиты','Оплаты','События','Файлы миграции'];const book=SpreadsheetApp.openById(FASTGO_SPREADSHEET_ID),snapshot={};
 names.forEach(name=>{const sheet=book.getSheetByName(name),last=sheet.getLastRow(),headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);while(headers.length&&!headers[headers.length-1])headers.pop();const rows=[];if(last>1){const keys=sheet.getRange(2,name==='Товары'?12:1,last-1,1).getValues();const ranges=[];keys.forEach((v,i)=>{if(!v[0])return;const n=i+2,r=ranges[ranges.length-1];if(r&&n<=r[1]+4&&n-r[0]<150)r[1]=n;else ranges.push([n,n]);});ranges.forEach(r=>sheet.getRange(r[0],1,r[1]-r[0]+1,headers.length).getValues().forEach((values,i)=>{if(!(name==='Товары'?values[11]:values[0]))return;const row={__row:r[0]+i};headers.forEach((h,j)=>row[h]=values[j] instanceof Date?values[j].toISOString():values[j]===null?'':values[j]);rows.push(row);}));}snapshot[name]={headers:headers,rows:rows};});return snapshot;
}
function installNativeSync(){
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try{const check=nativeSyncRequest_('verify',{snapshot:nativeSnapshot_()});if(!check.equal)throw Error('Рабочий снимок отличается от Google. Перенос нужно повторно сверить до переключения.');
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncNativeChanges').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncNativeChanges').timeBased().everyMinutes(1).create();
  nativeSyncRequest_('claim',{});console.log('Синхронизация подключена. Снимок совпадает.');
 }finally{lock.releaseLock();}
}
function syncNativeChanges(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{const job=nativeSyncRequest_('claim',{});if(job.empty||job.busy)return;
  try{const book=SpreadsheetApp.openById(FASTGO_SPREADSHEET_ID),requests=[],growth={};
   job.changes.forEach(c=>{const sheet=book.getSheetByName(c.sheet);if(!sheet)throw Error('Нет листа '+c.sheet);const headers=job.headers[c.sheet],actual=sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);if(JSON.stringify(actual)!==JSON.stringify(headers))throw Error('Изменились столбцы '+c.sheet);const id=sheet.getSheetId();if(c.row>sheet.getMaxRows())growth[id]=Math.max(growth[id]||0,c.row-sheet.getMaxRows());
    Object.keys(c.values).forEach(key=>{const col=headers.indexOf(key);if(col<0)throw Error('Неизвестный столбец');const value=c.values[key],cell=value===null||value===''?{}:{userEnteredValue:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:{stringValue:String(value)}};requests.push({updateCells:{range:{sheetId:id,startRowIndex:c.row-1,endRowIndex:c.row,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[cell]}],fields:'userEnteredValue'}});});
   });
   Object.keys(growth).forEach(id=>requests.unshift({appendDimension:{sheetId:Number(id),dimension:'ROWS',length:growth[id]}}));
   const response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+FASTGO_SPREADSHEET_ID+':batchUpdate',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:requests}),muteHttpExceptions:true});
   if(response.getResponseCode()!==200)throw Error('Google не подтвердил пакет изменений');
   nativeSyncRequest_('ack',{id:job.id,lease:job.lease});
  }catch(e){nativeSyncRequest_('ack',{id:job.id,lease:job.lease,error:'Не удалось подтвердить пакет. Будет повторная попытка.'});throw e;}
 }finally{lock.releaseLock();}
}
