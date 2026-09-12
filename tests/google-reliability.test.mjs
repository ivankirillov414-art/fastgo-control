import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const source=['Code.gs','Reliability.gs'].map(f=>readFileSync(new URL('../google-apps-script/'+f,import.meta.url),'utf8')).join('\n');
const schema=JSON.parse(readFileSync(new URL('./google-schema.json',import.meta.url),'utf8'));
const owner={id:'11111111-1111-4111-8111-111111111111',role:'owner',email:'owner@example.invalid'};
const manager={id:'22222222-2222-4222-8222-222222222222',role:'manager',email:'manager@example.invalid'};
const part='33333333-3333-4333-8333-333333333333';
function harness(){
  let sequence=0,locked=false,fault='',clock=Date.now(),fetches=0;
  const props=new Map([['FASTGO_RELIABILITY_READY','workshop-reliability-2026-09-12'],['FASTGO_JOURNAL_FOLDER','journals']]),files=new Map(),tables={};
  class Sheet{
    constructor(name,headers){this.name=name;this.id=++sequence;this.cells=[headers.slice()];this.max=1000;}
    getSheetId(){return this.id}getLastRow(){return this.cells.length}getLastColumn(){return this.cells[0].length}getMaxRows(){return this.max}
    getRange(row,col,n,m){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.cells[row+i-1]?.[col+j-1]??''))};}
  }
  for(const [name,headers]of Object.entries(schema))tables[name]=new Sheet(name,headers);
  tables['Операции API']=new Sheet('Операции API',['request_id','actor_id','action','fingerprint','result','created_at']);
  tables['Фото товаров']=new Sheet('Фото товаров',['photo_id','product_id','category','path','created_at','sha256']);
  function seed(name,obj){const t=tables[name];t.cells.push(t.cells[0].map(h=>obj[h]??''));}
  seed('Товары',{product_id:part,'Модель / название':'Тестовый товар','Категория':'Тест','Штрих-код':'FGP-00000001','Остаток, шт.':1,'Цена закупки, ₽':40,'Цена продажи, ₽':100,'Активен':true});
  seed('Категории',{'Категория (ключ)':'Тест'});
  for(const [Ключ,Значение]of Object.entries({intakes_folder_id:'intakes',backups_folder_id:'backups',documents_folder_id:'documents',products_photo_folder_id:'products'}))seed('Настройки',{Ключ,Значение});
  const blob=(bytes,mime='application/json')=>({getDataAsString:()=>typeof bytes==='string'?bytes:Buffer.from(bytes).toString(),getBytes:()=>[...Buffer.from(bytes)],getContentType:()=>mime});
  function file(data,name='file'){
    const id='drive-'+randomUUID();let access='PRIVATE';const f={getId:()=>id,getName:()=>name,getUrl:()=>`https://drive.google.com/file/d/${id}/view`,getBlob:()=>data,setContent:v=>{data=blob(v)},setSharing:a=>{access=a},getSharingAccess:()=>access,getSize:()=>data.getBytes().length};files.set(id,f);return f;
  }
  const folder={getUrl:()=> 'https://drive.google.com/drive/folders/test',createFolder:()=>folder,createFile:b=>file(b),setSharing:()=>{},getSharingAccess:()=> 'PRIVATE'};
  const context=vm.createContext({console,Date:class extends Date{static now(){return clock}},Map,Set,JSON,Object,Array,String,Number,Math,Error,
    SpreadsheetApp:{openById:()=>({getSheetByName:n=>tables[n]})},
    LockService:{getScriptLock:()=>({waitLock:()=>{if(locked)throw Error('lock busy');locked=true},releaseLock:()=>{locked=false}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
    Utilities:{getUuid:randomUUID,newBlob:blob,base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:b=>Buffer.from(b).toString('base64'),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...createHash('sha256').update(typeof v==='string'?v:Buffer.from(v)).digest()]},
    ScriptApp:{getOAuthToken:()=> 'test-only'},DriveApp:{Access:{PRIVATE:'PRIVATE'},Permission:{NONE:'NONE'},getFolderById:()=>folder,getFileById:id=>{if(!files.has(id))throw Error('No file');return files.get(id)}},
    UrlFetchApp:{fetch:(_,o)=>{
      assert.equal(locked,true);fetches++;
      if(fault==='before'){fault='';throw Error('Connection lost before commit');}
      const cloned=Object.fromEntries(Object.entries(tables).map(([n,t])=>[n,structuredClone(t.cells)]));
      for(const r of JSON.parse(o.payload).requests){if(r.updateSheetProperties)continue;const u=r.updateCells,t=Object.values(tables).find(x=>x.id===u.start.sheetId),a=cloned[t.name];while(a.length<=u.start.rowIndex)a.push([]);const v=u.rows[0].values[0].userEnteredValue;a[u.start.rowIndex][u.start.columnIndex]=v?Object.values(v)[0]:'';}
      if(fault==='invalid'){fault='';return {getResponseCode:()=>400};}
      for(const [n,cells]of Object.entries(cloned))tables[n].cells=cells;
      if(fault==='after'){fault='';throw Error('Response lost after commit');}
      return {getResponseCode:()=>200};
    }}
  });
  vm.runInContext(source,context);
  const run=(action,p={},actor=owner)=>JSON.parse(JSON.stringify(context.route_(action,JSON.parse(JSON.stringify(p)),actor)));
  const sale=(extra={})=>({request_id:randomUUID(),payment_method:'cash',items:[{part_id:part,quantity:1}],...extra});
  const rows=n=>tables[n].cells.slice(1).map(r=>Object.fromEntries(tables[n].cells[0].map((h,i)=>[h,r[i]??''])));
  return {run,sale,rows,seed,context,props,files,setFault:x=>fault=x,advance:()=>clock+=301000,fetches:()=>fetches,lock:()=>locked=true,unlock:()=>locked=false};
}
test('sale, stock movement, line, sequence and receipt commit together; double click is idempotent',()=>{
  const h=harness(),p=h.sale(),a=h.run('sale',p),b=h.run('sale',p);assert.deepEqual(a,b);assert.equal(h.fetches(),1);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],0);for(const t of ['Продажи','Строки продаж','Движения склада','Операции API'])assert.equal(h.rows(t).length,1);
});
test('two employees selling last unit: only one succeeds',()=>{const h=harness();h.run('sale',h.sale(),owner);assert.throws(()=>h.run('sale',h.sale(),manager),/Недостаточно/);assert.equal(h.rows('Продажи').length,1);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],0);});
test('script lock prevents concurrent mutation from entering critical section',()=>{const h=harness();h.lock();assert.throws(()=>h.run('sale',h.sale()),/lock busy/);h.unlock();assert.equal(h.rows('Продажи').length,0);});
test('lost response after commit: recover receipt without decrementing again',()=>{const h=harness(),p=h.sale();h.setFault('after');assert.throws(()=>h.run('sale',p));assert.equal(h.rows('Товары')[0]['Остаток, шт.'],0);const a=h.run('sale',p);assert.ok(a.id);assert.equal(h.fetches(),1);assert.equal(h.props.has('FASTGO_PENDING_INTENT'),false);});
test('lost connection before commit fences all operations, then recovers original once',()=>{const h=harness(),p=h.sale();h.setFault('before');assert.throws(()=>h.run('sale',p));assert.equal(h.rows('Продажи').length,0);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],1);assert.throws(()=>h.run('catalog'),/незавершённая/);h.advance();h.run('sale',p);assert.equal(h.rows('Продажи').length,1);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],0);});
test('invalid atomic batch changes nothing',()=>{const h=harness();h.setFault('invalid');assert.throws(()=>h.run('sale',h.sale()));assert.equal(h.rows('Продажи').length,0);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],1);});
test('request id cannot be reused with different payload or employee',()=>{const h=harness(),p=h.sale();h.run('sale',p);assert.throws(()=>h.run('sale',{...p,note:'different'}),/Код уже/);assert.throws(()=>h.run('sale',p,manager),/Код уже/);});
test('receipt repeat increases stock only once',()=>{const h=harness(),p={request_id:randomUUID(),part_id:part,movement_type:'receipt',quantity:3,note:'test'};h.run('stock',p);h.run('stock',p);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],4);});
const intake=()=>({request_id:randomUUID(),kind:'repair',last_name:'Тест',first_name:'Проверка',phone:'+70000000000',brand:'Test',model:'Unit'});
test('intake → repair with stock → approval and QA → payment → issue, including retry',()=>{
  const h=harness(),p=intake(),r=h.run('create',p);assert.equal(h.run('create',p).id,r.id);assert.equal(h.rows('Клиенты').length,1);assert.equal(h.rows('Приёмки').length,1);
  const update={kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),status:'repair',works:[{name:'Диагностика',quantity:1,price:200}],parts:[{part_id:part,name:'Тестовый товар',quantity:1,price:100}],discount:0};
  const fixed=h.run('update',update);h.run('update',update);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],0);
  assert.throws(()=>h.run('update',{...update,request_id:randomUUID(),revision:fixed.revision,status:'issued'}),/согласование|готовность/);
  const ready=h.run('update',{...update,request_id:randomUUID(),revision:fixed.revision,status:'ready',quality_checked:true,approve:true,approval_note:'test approval'});
  assert.throws(()=>h.run('update',{...update,request_id:randomUUID(),revision:ready.revision,status:'issued'}),/оплат/);
  assert.throws(()=>h.run('payment',{kind:'repair',id:r.id,request_id:randomUUID(),amount:301,method:'cash'}),/превышает/);
  const pay={kind:'repair',id:r.id,request_id:randomUUID(),amount:300,method:'cash'};h.run('payment',pay);h.run('payment',pay);
  assert.throws(()=>h.run('update',{...update,request_id:randomUUID(),revision:ready.revision,status:'issued'}),/изменена/);
  const paid=h.run('get',{kind:'repair',id:r.id}).record;const issued=h.run('update',{...update,request_id:randomUUID(),revision:paid.revision,status:'issued'});assert.equal(issued.status,'issued');assert.equal(issued.paid_amount,300);assert.equal(h.rows('Оплаты').length,1);
});
test('failure while staging repair leaves old order and stock intact',()=>{const h=harness(),r=h.run('create',intake());const old=h.rows('Товары')[0]['Остаток, шт.'];h.context.addEvent_=()=>{throw Error('injected stage failure')};assert.throws(()=>h.run('update',{id:r.id,kind:'repair',revision:r.revision,request_id:randomUUID(),status:'repair',parts:[{part_id:part,name:'test',quantity:1,price:100}]}),/injected/);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],old);assert.equal(h.rows('Движения склада').length,0);});
test('private product photo, primary category and foreign photo protection',()=>{const h=harness(),p={request_id:randomUUID(),part_id:part,content_type:'image/png',content_base64:Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64'),primary_for_category:true};const result=h.run('part_photo_upload',p);assert.equal(h.files.get(result.photo_id).getSharingAccess(),'PRIVATE');assert.equal(h.run('part_photo_url',{part_id:part}).url.startsWith('data:image/png;base64,'),true);assert.equal(h.run('part_photo_url',{category:'Тест'}).url.startsWith('data:'),true);assert.throws(()=>h.run('part_photo_primary',{request_id:randomUUID(),part_id:part,photo_id:'foreign'}),/не относится/);assert.throws(()=>h.run('part_photo_upload',{...p,request_id:randomUUID(),content_base64:'PHNjcmlwdD4='}),/не соответствует/);});
test('mechanic cannot receive stock or view unrelated repair',()=>{const h=harness(),mechanic={...manager,role:'mechanic'},r=h.run('create',intake());assert.throws(()=>h.run('stock',{request_id:randomUUID(),part_id:part,quantity:1},mechanic),/доступ/);assert.throws(()=>h.run('get',{id:r.id},mechanic),/доступ/);});

test('migration verifies source and Drive hash, preserves original, and repeats once',()=>{const h=harness(),id=crypto.randomUUID(),bytes=Buffer.from([255,216,255,1,2,3]);h.seed('Файлы миграции',{object_id:id,'Исходный путь':'storage/test/image.jpg','Размер, байт':bytes.length,record_id:''});const p={object_id:id,request_id:crypto.randomUUID(),content_base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),content_type:'image/jpeg'};const r=h.run('migrate_legacy_file',p);assert.equal(r.sha256,p.sha256);assert.equal(h.run('migrate_legacy_file',p).path,r.path);assert.equal(h.rows('Файлы миграции')[0]['Исходный путь'],'storage/test/image.jpg');assert.equal(h.run('migration_manifest')[0].migrated,true);});
test('migration checksum mismatch leaves manifest unchanged',()=>{const h=harness(),id=crypto.randomUUID();h.seed('Файлы миграции',{object_id:id,'Исходный путь':'storage/test/image.jpg','Размер, байт':4});assert.throws(()=>h.run('migrate_legacy_file',{object_id:id,request_id:crypto.randomUUID(),content_base64:'dGVzdA==',sha256:'bad'}),/сумма/);assert.equal(h.rows('Файлы миграции')[0]['Google Drive URL'],'');});

test('duplicate lines are aggregated under the same lock and cannot oversell',()=>{const h=harness();assert.throws(()=>h.run('sale',h.sale({items:[{part_id:part,quantity:1},{part_id:part,quantity:1}]})),/Недостаточно/);assert.equal(h.rows('Товары')[0]['Остаток, шт.'],1);assert.equal(h.rows('Продажи').length,0);});
