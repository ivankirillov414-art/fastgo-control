import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {nativeClient} from '../supabase/functions/_shared/native-client.js';
import {preparePartsIssue} from '../supabase/functions/fastgo-warehouse/parts-issue.js';
import {prepareRepairPayment} from '../supabase/functions/fastgo-warehouse/repair.js';
const owner={id:randomUUID(),role:'owner',name:'Тестовый владелец'},mechanic={id:randomUUID(),role:'mechanic',name:'Тестовый мастер'};
function fixture(){
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),engine=createNativeEngine(Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}])));
 const seed=(sheet,row)=>engine.sheets[sheet].rows.push({...Object.fromEntries(engine.sheets[sheet].headers.map(k=>[k,''])),__row:engine.sheets[sheet].rows.length+2,...row});
 const part=randomUUID(),service=randomUUID();seed('Сотрудники',{employee_id:mechanic.id,'ФИО':mechanic.name,'Роль':'Механик','Активен':true});seed('Товары',{product_id:part,'Модель / название':'Амортизатор','Штрих-код':'FGP-00000001','Категория':'Запчасти','Остаток, шт.':0,'Цена продажи, ₽':500,'Цена закупки, ₽':200,'Активен':true});seed('Прайс работ',{service_id:service,'Работа':'Диагностика','Работа, ₽':1000,'Активна':true});
 let r=engine.run('create',{kind:'repair',phone:'+79990000000',last_name:'Тест',first_name:'Клиент',brand:'Kugoo',model:'M4',request_id:randomUUID()},owner);
 const get=()=>engine.run('get',{kind:'repair',id:r.id},owner).record;
 const edit=(group,values,extra={},actor=owner)=>engine.run('service_edit',{id:r.id,kind:'repair',revision:get().revision,request_id:randomUUID(),group,values,...extra},actor);
 const apply=changes=>{for(const c of changes){let row=engine.sheets[c.sheet].rows.find(x=>x.__row===c.row);if(!row){row={__row:c.row};engine.sheets[c.sheet].rows.push(row);}Object.assign(row,c.values);}};
 const start=()=>{r=engine.run('update',{kind:'repair',id:r.id,revision:get().revision,request_id:randomUUID(),step_flow:true,flow_action:'diagnose'},owner);};
 return {engine,part,service,get,edit,apply,start,seed};
}
test('service fields persist through a fresh snapshot while identifiers, prices and ledger remain intact',()=>{
 const h=fixture(),id=h.get().id;h.edit('client',{last_name:'Проверка',first_name:'Клиент',middle_name:'Иванович',phone:'+79991112233',email:'test@example.invalid'},{expected:h.get().client_details});
 h.edit('vehicle',{brand:'Kugoo',model:'M4 Pro',serial_number:'SER-123',accessories:'Зарядное устройство',condition_notes:'Царапина на деке',issue_description:'Не включается',promised_date:'2026-11-20'});
 h.edit('diagnostics',{diagnostics_notes:'Проверен контроллер',promised_date:'',note:'Позвонить до выдачи'}, {},mechanic);h.edit('handover',{warranty_days:30,handover_notes:'Комплектность проверена'});
 const reloaded=createNativeEngine(JSON.parse(JSON.stringify(h.engine.sheets))).run('get',{kind:'repair',id},owner).record;
 assert.equal(reloaded.id,id);assert.equal(reloaded.phone,'+79991112233');assert.equal(reloaded.model,'M4 Pro');assert.equal(reloaded.serial_number,'SER-123');assert.equal(reloaded.accessories,'Зарядное устройство');assert.equal(reloaded.promised_date,'');assert.equal(reloaded.warranty_days,30);assert.equal(reloaded.diagnostics_notes,'Проверен контроллер');assert.equal(reloaded.total_amount,0);assert.equal(reloaded.paid_amount,0);assert.equal(h.engine.sheets['Оплаты'].rows.length,0);assert.equal(h.engine.sheets['Движения склада'].rows.length,0);
 const edits=h.engine.sheets['События'].rows.filter(x=>x['Действие']==='service_edit');assert.equal(edits.length,4);assert(edits.every(x=>JSON.parse(x['Детали']).before&&JSON.parse(x['Детали']).after));
});
test('repair editing requires a revision, rejects stale values and preserves role and client conflict checks',()=>{
 const h=fixture(),r=h.get(),base={id:r.id,request_id:randomUUID(),group:'diagnostics',values:{diagnostics_notes:'Тест'}};
 for(const revision of [undefined,null,'',0,-1,1.5])assert.throws(()=>h.engine.run('service_edit',{...base,revision},owner),/версия/);
 h.edit('diagnostics',{diagnostics_notes:'Первая правка'});assert.throws(()=>h.engine.run('service_edit',{...base,revision:r.revision},owner),/измен/);
 for(const [group,values]of Object.entries({client:{phone:'+79990000000'},vehicle:{serial_number:'T'},handover:{warranty_days:1},pricing:{discount:0},parts_return:{source_index:0},customer:{phone:'+79990000000'}}))assert.throws(()=>h.edit(group,values,{},mechanic),/сотруднику/);
 assert.throws(()=>h.edit('diagnostics',{diagnostics_notes:'Тест'},{},{...owner,role:'seller'}),/доступ/);assert.throws(()=>h.edit('diagnostics',{paid_amount:1}),/Поле/);
 const before=h.get().client_details;h.edit('client',{phone:'+79990000001'},{expected:before});assert.throws(()=>h.edit('client',{email:'later@example.invalid'},{expected:before}),/клиента уже изменена/);
 const c=h.engine.sheets['Клиенты'].rows[0];assert.throws(()=>h.engine.run('service_edit',{id:c.client_id,request_id:randomUUID(),group:'customer',expected:before,values:{full_name:'Поздняя правка'}},owner),/изменилась/);
});
test('work name, quantity, custom rows and price edit this repair, then full QR payment completes it',()=>{
 const h=fixture();h.start();let r=h.edit('works',{works:[{catalog_id:h.service,name:'Уточнённая диагностика',quantity:2,price:750.25},{name:'Своя проверка',quantity:1,price:100}]},{},mechanic);
 assert.equal(r.total_amount,1600.5);assert.equal(h.engine.sheets['Прайс работ'].rows[0]['Работа'],'Диагностика');assert.equal(h.engine.sheets['Прайс работ'].rows[0]['Работа, ₽'],1000);
 const issue=preparePartsIssue({sheets:h.engine.sheets},{request_id:randomUUID(),items:[{part_id:h.part,quantity:1}]},{id:randomUUID(),repair_id:r.id,scope:'repair',requested_by:owner.id},owner);h.apply(issue.changes);assert.equal(h.engine.sheets['Товары'].rows[0]['Остаток, шт.'],-1);
 r=h.get();r=h.engine.run('update',{kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),step_flow:true,flow_action:'complete',quality_checked:true,payment_qr:true},mechanic);
 const paid=prepareRepairPayment({sheets:h.engine.sheets},{request_id:randomUUID(),repair_id:r.id,expected_revision:r.revision,amount:2100.5,method:'cash'},owner);h.apply(paid.changes);r=h.get();assert.equal(r.status,'issued');assert.equal(r.paid_amount,2100.5);assert.equal(h.engine.sheets['Оплаты'].rows.length,1);assert.equal(h.engine.sheets['Движения склада'].rows.length,1);
 assert.throws(()=>h.edit('diagnostics',{diagnostics_notes:'Поздно'},{},mechanic),/Закрытая карточка/);r=h.edit('handover',{warranty_days:45,handover_notes:'Исправлена опечатка'},{reason:'Опечатка в гарантии'});assert.equal(r.status,'issued');assert.equal(r.paid_amount,2100.5);
});
test('part correction creates a return movement and invalidates the prepared payment, never overwrites stock history',()=>{
 const h=fixture();h.start();let r=h.edit('works',{works:[{name:'Работа',quantity:1,price:1000}]});const issue=preparePartsIssue({sheets:h.engine.sheets},{request_id:randomUUID(),items:[{part_id:h.part,quantity:1}]},{id:randomUUID(),repair_id:r.id,scope:'repair',requested_by:owner.id},owner);h.apply(issue.changes);r=h.get();r=h.engine.run('update',{kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),step_flow:true,flow_action:'complete',quality_checked:true,payment_qr:true},owner);
 assert.throws(()=>h.edit('parts_return',{source_index:0}),/причину/);r=h.edit('parts_return',{source_index:0},{reason:'Выдана неверная деталь'});assert.equal(r.status,'repair');assert.equal(r.quality_checked,false);assert.equal(r.parts.length,0);assert.equal(r.step_state.payment_qr,false);assert.equal(h.engine.sheets['Движения склада'].rows.length,2);assert.equal(h.engine.sheets['Товары'].rows[0]['Остаток, шт.'],0);
});
test('durable lost-response retry commits once and customer edits retain historical intake snapshots',async()=>{
 const h=fixture();let version=1,lost=true;const receipts=new Map(),db=async(table,q,method,p)=>{
  if(table==='rpc/workshop_native_snapshot')return structuredClone({version,sheets:h.engine.sheets});
  if(table==='workshop_native_receipts'){const id=new URLSearchParams(q).get('request_id').slice(3);return receipts.has(id)?[receipts.get(id)]:[];}
  if(table==='rpc/workshop_native_commit'){if(p.p_version!==version)return {retry:true};h.apply(p.p_changes);version++;receipts.set(p.p_request_id,{actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});if(lost){lost=false;throw Error('response lost');}return {result:p.p_result};}throw Error(table);
 };
 const p={id:h.get().id,revision:h.get().revision,group:'diagnostics',values:{diagnostics_notes:'Сохранено один раз'},request_id:randomUUID()},fingerprint=createHash('sha256').update(JSON.stringify(p)).digest('hex');p.__request_fingerprint=fingerprint;
 const run=async()=>{const client=nativeClient({db,actor:owner,google:async()=>{throw Error('No Google');}}),old=await client('operation_retry',{request_id:p.request_id,action:'service_edit',fingerprint});return old.status==='committed'?old.result:client('service_edit',p);};
 await assert.rejects(run(),/response lost/);assert.equal((await run()).diagnostics_notes,'Сохранено один раз');assert.equal(h.engine.sheets['События'].rows.filter(x=>x['Действие']==='service_edit').length,1);assert.equal(h.get().revision,2);
 const c=h.get().client_details,clientId=h.get().client_id;h.engine.run('service_edit',{id:clientId,request_id:randomUUID(),group:'customer',expected:c,values:{full_name:'Исправленное ФИО',phone:'+79990000002',email:''}},owner);
 assert.equal(h.engine.run('customers',{id:clientId},owner).items[0].phone,'+79990000002');assert.equal(h.get().phone,'+79990000000');
});
