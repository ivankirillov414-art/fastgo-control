import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {pickupCode,readPickupCode} from '../supabase/functions/_shared/parts-pickup-code.js';
import {partsIssue,preparePartsIssue} from '../supabase/functions/fastgo-warehouse/parts-issue.js';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {requestRepairPickup} from '../supabase/functions/fastgo-workshop-api/parts-pickup.js';
import {digest} from '../supabase/functions/fastgo-warehouse/handler.js';
const owner={id:randomUUID(),role:'owner'},master=randomUUID(),repair=randomUUID(),part=randomUUID(),station=randomUUID(),terminal=randomUUID(),secret='test-signing-secret-not-production';
function fixture(){
 const schema=JSON.parse(fs.readFileSync(new URL('google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 function seed(name,fields){const row={...Object.fromEntries(sheets[name].headers.map(k=>[k,''])),__row:sheets[name].rows.length+2,...fields};sheets[name].rows.push(row);return row;}
 seed('Товары',{product_id:part,'Модель / название':'Камера 10 × 2,5','Штрих-код':'FGP-00000001','Остаток, шт.':5,'Цена продажи, ₽':100,'Цена закупки, ₽':50,'Активен':true});
 seed('Приёмки',{intake_id:repair,'Бренд / модель':'Kugoo Max Speed','Серийный номер':'SN-TEST-42'});
 seed('Сотрудники',{employee_id:master,'ФИО':'Мастер теста','Роль':'mechanic','Активен':true});
 const raw=seed('Ремонты',{repair_id:repair,intake_id:repair,master_id:master,'Мастер':'Мастер теста','Номер ремонта':'FGR-TEST','Статус':'Диагностика','Диагностика':'Прокол камеры','Работы':'[{"name":"Замена","price":300,"quantity":1}]','Стоимость работ':300,'Строки запчастей':'[]','Итого':300,'Оплачено':0,'Скидка':0,revision:1});
 let version=1,lose=false;const receipts=new Map(),commits=[];
 const snapshot=()=>structuredClone({version,sheets});
 const db=async(table,q='',method,body)=>{
  if(table==='workshop_members')return [{profile_id:master,name:'Мастер теста'}];
  if(table==='rpc/workshop_native_snapshot')return snapshot();
  if(table==='workshop_native_receipts'){const r=receipts.get(new URLSearchParams(q).get('request_id')?.slice(3));return r?[r]:[];}
  if(table==='rpc/workshop_native_commit'){
   const old=receipts.get(body.p_request_id);if(old)return {result:old.result};if(body.p_version!==version)return {retry:true};
   for(const c of body.p_changes){assert.ok(sheets[c.sheet]);for(const k of Object.keys(c.values))assert.ok(sheets[c.sheet].headers.includes(k),'schema '+c.sheet+'.'+k);let row=sheets[c.sheet].rows.find(x=>x.__row===c.row);if(!row){row={__row:c.row};sheets[c.sheet].rows.push(row);}Object.assign(row,c.values);}
   version++;receipts.set(body.p_request_id,{actor_id:body.p_actor,action:body.p_action,fingerprint:body.p_fingerprint,result:body.p_result});commits.push(body);
   if(lose){lose=false;throw Error('response lost');}return {result:body.p_result};
  }throw Error(table);
 };
 return {sheets,raw,snapshot,seed,commits,lose:()=>lose=true,context:{db,actor:owner,device:{id:terminal,kind:'terminal'},stationId:station,key:secret,digest}};
}
async function code(){return (await pickupCode({id:repair,assigned_master_id:master,repair_number:44,brand:'Kugoo',model:'Max Speed'},secret)).code;}
test('pickup QR is signed, bound to repair and master, expires and rejects a customer repair URL',async()=>{
 const c=await code(),ticket=await readPickupCode(c,secret);assert.equal(ticket.repair_id,repair);assert.equal(ticket.master_id,master);
 for(const bad of [c.replace('FGPARTS1','OTHER'),c.slice(0,-2)+'00','https://example.invalid/order?repair='+repair])await assert.rejects(readPickupCode(bad,secret));
 await assert.rejects(readPickupCode(c,secret,{now:(ticket.expires+1)*1000}),/истёк/);
});
test('issue atomically links scanned parts to technique and repair, decrements stock once and changes no payment',async()=>{
 const h=fixture(),c=await code(),p={request_id:randomUUID(),code:c,items:[{part_id:part,quantity:1},{part_id:part,quantity:1}]};
 const q=await partsIssue('parts_pickup_quote',{code:c},h.context);assert.equal(q.serial,'SN-TEST-42');assert.equal(q.master_id,master);
 const issued=await partsIssue('parts_issue',p,h.context);assert.equal(issued.serial,'SN-TEST-42');assert.equal(issued.total,500);assert.equal(issued.items[0].quantity,2);
 const saved=JSON.parse(h.raw['Строки запчастей']);assert.equal(saved[0].tsd_issue_id,p.request_id);assert.equal(saved[0].quantity,2);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal(h.raw.revision,2);
 assert.equal(h.sheets['Оплаты'].rows.length,0);assert.equal(h.sheets['Продажи'].rows.length,0);assert.equal(h.sheets['События'].rows.filter(x=>x['Действие']==='parts_issued').length,1);
 assert.deepEqual(await partsIssue('parts_issue',p,h.context),issued);assert.equal(h.commits.length,1);
 await assert.rejects(partsIssue('parts_issue',{...p,request_id:randomUUID()},h.context),/уже выданы/);
});
test('lost issue response is resolved by receipt; price and quantities cannot change on retry',async()=>{
 const h=fixture(),p={request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}]};h.lose();await assert.rejects(partsIssue('parts_issue',p,h.context),/response lost/);
 await assert.rejects(partsIssue('parts_issue',{...p,items:[{part_id:part,quantity:3}]},h.context),/уже использован/);
 await partsIssue('parts_issue',p,h.context);assert.equal(h.commits.length,1);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);
});

test('printed repair QR selects the repair without a worker; confirmation uses a signed ticket',async()=>{
 const h=fixture(),url='https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+repair;
 const quote=await partsIssue('parts_pickup_quote',{code:url},h.context);assert.equal(quote.id,repair);assert.equal(quote.master_id,undefined);assert.equal((await readPickupCode(quote.code,secret)).scope,'repair');assert.match(quote.code,/^FGPARTS1\./);assert.equal(h.commits.length,0);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],5);
 await assert.rejects(partsIssue('parts_issue',{request_id:randomUUID(),code:url,items:[{part_id:part,quantity:2}]},h.context));
 const issued=await partsIssue('parts_issue',{request_id:randomUUID(),code:quote.code,items:[{part_id:part,quantity:2}]},h.context);assert.equal(issued.repair_id,repair);assert.equal(issued.items[0].quantity,2);assert.equal(h.commits.length,1);
});
test('repair QR lookup rejects foreign links, closed repairs and reassigned legacy tickets without writes',async()=>{
 const url='https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+repair;
 for(const mode of ['foreign','closed','reassigned']){const h=fixture();if(mode==='closed')h.raw['Статус']='Готов';const input=mode==='foreign'?url.replace('ivankirillov414-art.github.io','evil.invalid'):mode==='reassigned'?await code():url;if(mode==='reassigned')h.raw.master_id=randomUUID();await assert.rejects(partsIssue('parts_pickup_quote',{code:input},h.context));assert.equal(h.commits.length,0);}
});

test('service laptop and phone accounts open repair-only QR and issue through ATOL or TSD without assignment',async()=>{
 for(const role of ['developer','owner','admin','receiver','manager','mechanic'])for(const kind of ['station','terminal'])for(const assigned of ['',master]){
  const h=fixture(),requester=randomUUID(),member={role,active:true};h.raw.master_id=assigned;h.raw['Мастер']=assigned?'Исторический мастер':'';
  const before=h.snapshot(),signed=await requestRepairPickup({kind:'repair',id:repair},{storageMode:'postgres',member,actorId:requester,key:secret,getRepair:async id=>createNativeEngine(h.sheets).run('get',{kind:'repair',id},{id:requester,role}).record});
  const ticket=await readPickupCode(signed.code,secret);assert.equal(ticket.scope,'repair');assert.equal(ticket.repair_id,repair);assert.equal(ticket.requested_by,requester);assert.equal(ticket.master_id,undefined);assert.deepEqual(h.snapshot(),before,'opening QR never assigns a worker or changes the repair');
  const context={...h.context,device:{id:kind==='station'?station:terminal,kind},db:async(table,q,...args)=>{
   if(table==='workshop_members'){assert.ok(q.includes('profile_id=eq.'+requester));assert.ok(q.includes('active=eq.true'));assert.ok(q.includes('role=in.(developer,owner,admin,receiver,manager,mechanic)'));return [{profile_id:requester,role}];}
   return h.context.db(table,q,...args);
  }};
  const quote=await partsIssue('parts_pickup_quote',{code:signed.code},context);assert.equal(quote.id,repair);assert.equal(quote.master_id,undefined);
  const p={request_id:randomUUID(),code:signed.code,items:[{part_id:part,quantity:2}]},result=await partsIssue('parts_issue',p,context);
  assert.equal(result.repair_id,repair);assert.equal(result.requested_by,requester);assert.equal(result.master_id,undefined);assert.equal(h.raw.master_id,assigned);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);
  assert.equal(JSON.parse(h.raw['Строки запчастей'])[0].quantity,2);assert.equal(h.sheets['Продажи'].rows.length,0);assert.equal(h.sheets['Оплаты'].rows.length,0);
  assert.ok(!h.commits[0].p_changes.some(c=>c.sheet==='События'&&c.values['Действие']==='master_issue'));
  assert.deepEqual(await partsIssue('parts_issue',p,context),result);assert.equal(h.commits.length,1);
 }
});

test('repair pickup retains active membership, normal card access, status and signature checks',async()=>{
 const h=fixture(),requester=randomUUID(),base={storageMode:'postgres',member:{role:'owner',active:true},actorId:requester,key:secret,getRepair:async()=>({id:repair,status:'repair'})},params={kind:'repair',id:repair};
 for(const role of ['seller','customer','guest',''])await assert.rejects(requestRepairPickup(params,{...base,member:{role,active:true},getRepair:()=>assert.fail('denied role must not read a card')}),e=>e.status===403);
 await assert.rejects(requestRepairPickup(params,{...base,member:{role:'owner',active:false}}),e=>e.status===403);
 await assert.rejects(requestRepairPickup(params,{...base,getRepair:()=>{throw Object.assign(Error('Нет доступа'),{status:403});}}),e=>e.status===403);
 for(const status of ['ready','issued','cancelled'])await assert.rejects(requestRepairPickup(params,{...base,getRepair:async()=>({id:repair,status})}),e=>e.status===409);
 await assert.rejects(requestRepairPickup(params,{...base,getRepair:async()=>null}),e=>e.status===404);
 await assert.rejects(requestRepairPickup({...params,id:'bad'},base),e=>e.status===400);
 const signed=await requestRepairPickup(params,base);
 await assert.rejects(partsIssue('parts_pickup_quote',{code:signed.code},{...h.context,db:async(table,...args)=>table==='workshop_members'?[]:h.context.db(table,...args)}),/отключён/);
 await assert.rejects(readPickupCode(signed.code,secret,{now:Date.now()+86401000}),/истёк/);
 await assert.rejects(readPickupCode(signed.code,'other-key'));
 assert.equal(h.commits.length,0);
});

test('printed repair QR also issues directly into an unassigned repair on the paired cash device',async()=>{
 const h=fixture();h.raw.master_id='';h.raw['Мастер']='';const url='https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+repair;
 const context={...h.context,device:{id:station,kind:'station'},db:async(table,...args)=>{assert.notEqual(table,'workshop_members','a printed repair has no personal requester');return h.context.db(table,...args);}};
 const quote=await partsIssue('parts_pickup_quote',{code:url},context);assert.equal(quote.id,repair);assert.equal(quote.master_id,undefined);
 const result=await partsIssue('parts_issue',{request_id:randomUUID(),code:quote.code,items:[{part_id:part,quantity:2}]},context);assert.equal(result.repair_id,repair);assert.equal(h.raw.master_id,'');assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);
});
test('two terminals cannot consume the same pickup QR twice under a concurrent commit',async()=>{
 const h=fixture(),c=await code();const results=await Promise.allSettled([1,2].map(()=>partsIssue('parts_issue',{request_id:randomUUID(),code:c,items:[{part_id:part,quantity:1}]},h.context)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.commits.length,1);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],4);
});
test('closed/reassigned repairs and insufficient equipment stock cause no writes',async()=>{
 for(const mode of ['closed','reassigned','equipment']){const h=fixture();if(mode==='closed')h.raw['Статус']='Готов';if(mode==='reassigned')h.raw.master_id=randomUUID();if(mode==='equipment')h.sheets['Товары'].rows[0]['Категория']='Техника · Электросамокаты';
  await assert.rejects(partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:mode==='equipment'?6:1}]},h.context));assert.equal(h.commits.length,0);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],5);
 }
});
test('manual part insertion and forged issue fields are rejected; unchanged historic parts stay valid',()=>{
 const h=fixture(),p={kind:'repair',id:repair,revision:1,status:'diagnostics',parts:[{name:'Manual',part_id:part,price:0,quantity:1,tsd_issue_id:randomUUID()}]};
 assert.throws(()=>createNativeEngine(h.sheets).run('update',p,owner),/только через ТСД/);
 h.raw['Строки запчастей']=JSON.stringify(p.parts);const r=createNativeEngine(h.sheets).run('update',p,owner);assert.equal(r.parts.length,1);assert.equal(r.parts_status.mode,'issued');
});
test('ready requires TSD parts or explicit mechanic confirmation; confirmation is retained in audit',()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});const p={kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true};
 assert.throws(()=>createNativeEngine(h.sheets).run('update',p,{id:master,role:'mechanic'}),/Ремонт без запчастей/);
 const engine=createNativeEngine(h.sheets),ready=engine.run('update',{...p,no_parts:true},{id:master,role:'mechanic'});assert.equal(ready.status,'ready');assert.equal(ready.parts_status.mode,'none');assert.ok(engine.changes().some(x=>x.values['Действие']==='parts_not_needed'));
 assert.throws(()=>createNativeEngine(h.sheets).run('update',{...p,no_parts:true},{id:randomUUID(),role:'manager'}),/ставит мастер/);
});

test('zero stock can be issued once, then receipts and returns naturally repay the negative balance',async()=>{
 const h=fixture();h.sheets['Товары'].rows[0]['Остаток, шт.']=0;const p={request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}],scanner_source:'atol'};
 await partsIssue('parts_issue',p,h.context);await partsIssue('parts_issue',p,h.context);assert.equal(h.commits.length,1);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],-2);assert.equal(JSON.parse(h.raw['Строки запчастей'])[0].quantity,2);
 const engine=createNativeEngine(h.sheets),receipt={part_id:part,movement_type:'receipt',quantity:5,request_id:randomUUID()};engine.run('stock',receipt,owner);engine.run('stock',receipt,owner);assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],3);engine.run('stock',{part_id:part,movement_type:'return',quantity:1,request_id:randomUUID()},owner);assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],4);
});

test('completion uses positive persisted product references including documented legacy id lines',()=>{
 for(const stored of [[{part_id:part,name:'Выдано',quantity:1,price:0}],[{id:part,name:'Старая выдача',quantity:2,price:0,master_allocations:[{master_id:master,quantity:2}]}]]){
  const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0,'Строки запчастей':JSON.stringify(stored)});const engine=createNativeEngine(h.sheets),r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true},{id:master,role:'mechanic'});assert.equal(r.status,'ready');assert.equal(r.parts_status.mode,'legacy');assert.equal(engine.changes().some(x=>x.sheet==='Товары'),false,'already attached parts are never issued again');
 }
 for(const stored of [[],[{name:'Камера клиента',quantity:1,price:0}],[{part_id:part,quantity:0,price:0}],[{part_id:part,quantity:true,price:0}]]){
  const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0,'Строки запчастей':JSON.stringify(stored)});const engine=createNativeEngine(h.sheets);assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true},owner),/Ремонт без запчастей/);assert.equal(engine.changes().length,0);
 }
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});assert.throws(()=>createNativeEngine(h.sheets).run('update',{kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true,parts:[{part_id:part,quantity:1,price:0}]},owner),/только через ТСД/);
});

test('explicit false revokes no-parts confirmation and omission cannot resurrect it',()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});const engine=createNativeEngine(h.sheets),actor={id:master,role:'mechanic'};let r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'repair',no_parts:true},actor);assert.equal(r.parts_status.mode,'none');
 assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true,no_parts:false},actor),/Ремонт без запчастей/);
 r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'repair',no_parts:false},actor);assert.equal(r.parts_status.mode,'pending');assert.equal(engine.sheets['События'].rows.filter(x=>x['Действие']==='parts_required').length,1);
 assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true},actor),/Ремонт без запчастей/);
 r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true,no_parts:true},actor);assert.equal(r.parts_status.mode,'none');r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'issued',quality_checked:true,handover_notes:'Комплектность проверена'},owner);assert.equal(r.status,'issued','cash handover may omit the field after the master confirmed it');
});

test('a fake reopen reason cannot use a prior no-parts choice to finish an open repair',()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});const engine=createNativeEngine(h.sheets);let r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true,no_parts:true},owner);const before=engine.changes().length;assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'issued',handover_notes:'Проверено',reopen_reason:'Подделка'},owner),/только закрытый/);assert.equal(engine.changes().length,before);assert.equal(engine.run('get',{kind:'repair',id:repair},owner).record.status,'ready');
});

test('reassignment and authorized reopen invalidate old confirmation without altering historical records',()=>{
 const h=fixture(),otherMaster=randomUUID();h.seed('Сотрудники',{employee_id:otherMaster,'ФИО':'Второй мастер','Роль':'mechanic','Активен':true});Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});const engine=createNativeEngine(h.sheets);let r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'repair',no_parts:true},owner);
 r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'repair',assigned_master_id:otherMaster},owner);assert.equal(r.parts_status.mode,'pending');r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'repair',assigned_master_id:master},owner);assert.equal(r.parts_status.mode,'pending');assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true},owner),/Ремонт без запчастей/);
 r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true,no_parts:true},owner);r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'issued',handover_notes:'Проверено'},owner);const historic=createNativeEngine(engine.sheets);assert.equal(historic.run('get',{kind:'repair',id:repair},owner).record.status,'issued');assert.equal(historic.changes().length,0);
 for(const actor of [{id:master,role:'mechanic'},{id:randomUUID(),role:'receiver'}])assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'accepted',reopen_reason:'Новый осмотр'},actor),/администратор/);
 r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'accepted',reopen_reason:'Новый осмотр'},owner);assert.equal(r.parts_status.mode,'pending');
 for(const status of ['diagnostics','repair'])r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status},owner);assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true},owner),/Ремонт без запчастей/);
});

test('historical ready note edits do not require a new parts declaration, but a new issue does',()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'Готов','Работы':'[]','Стоимость работ':0,'Итого':0,'Контроль качества':true});const engine=createNativeEngine(h.sheets);const r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'ready',note:'Уточнение'},owner);assert.equal(r.status,'ready');assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'issued',handover_notes:'Проверено'},owner),/Ремонт без запчастей/);
});

test('all equipment categories retain shortage and non-negative adjustment guards while parts may be corrected below zero',()=>{
 for(const category of ['Техника · Электросамокаты','Техника · Новый вид','Электросамокаты','электровелосипеды','Велосипеды','Электромопеды','Электроскутеры','Другая техника']){
  const h=fixture();Object.assign(h.sheets['Товары'].rows[0],{'Категория':category,'Остаток, шт.':0});const engine=createNativeEngine(h.sheets);assert.throws(()=>engine.run('stock',{part_id:part,movement_type:'issue',quantity:2},owner),/Недостаточно/);assert.throws(()=>engine.run('stock',{part_id:part,movement_type:'adjustment',quantity:1,balance_after:-1},owner),/техники/);assert.equal(engine.changes().length,0);
 }
 const h=fixture(),engine=createNativeEngine(h.sheets);engine.run('stock',{part_id:part,movement_type:'adjustment',quantity:8,balance_after:-3},owner);assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],-3);
 for(const quantity of [0,-1,1.5,true,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>createNativeEngine(h.sheets).run('stock',{part_id:part,movement_type:'issue',quantity},owner),/количество/);
 assert.throws(()=>createNativeEngine(h.sheets).run('stock',{part_id:part,movement_type:'issue',quantity:1},{id:master,role:'mechanic',can_sell:true}),/недоступны/);
});

test('issuing and then returning every part cannot revive an older no-parts confirmation',async()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});let engine=createNativeEngine(h.sheets);const confirmed=engine.run('update',{kind:'repair',id:repair,revision:1,status:'repair',no_parts:true},owner);await h.context.db('rpc/workshop_native_commit','','POST',{p_actor:owner.id,p_action:'update',p_request_id:randomUUID(),p_fingerprint:'confirm-test',p_version:h.snapshot().version,p_changes:engine.changes(),p_result:confirmed});
 await partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}]},h.context);engine=createNativeEngine(h.sheets);const r=engine.run('update',{kind:'repair',id:repair,revision:h.raw.revision,status:'repair',parts:[]},owner);assert.equal(r.parts_status.mode,'pending');assert.ok(engine.sheets['События'].rows.some(e=>e['Действие']==='parts_required'));assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.throws(()=>engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',quality_checked:true},owner),/Ремонт без запчастей/);
});

test('a fresh explicit no-parts choice remains effective after all-parts return or master reassignment in the same save',async()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});await partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:1}]},h.context);let engine=createNativeEngine(h.sheets),r=engine.run('update',{kind:'repair',id:repair,revision:h.raw.revision,status:'ready',parts:[],no_parts:true,quality_checked:true},owner);assert.equal(r.parts_status.mode,'none');assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.deepEqual(engine.sheets['События'].rows.slice(-3).map(x=>x['Действие']),['parts_required','parts_not_needed','update']);
 const other=fixture(),newMaster=randomUUID();other.seed('Сотрудники',{employee_id:newMaster,'ФИО':'Новый мастер','Роль':'mechanic','Активен':true});Object.assign(other.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});engine=createNativeEngine(other.sheets);r=engine.run('update',{kind:'repair',id:repair,revision:1,status:'repair',no_parts:true},owner);r=engine.run('update',{kind:'repair',id:repair,revision:r.revision,status:'ready',assigned_master_id:newMaster,no_parts:true,quality_checked:true},owner);assert.equal(r.parts_status.mode,'none');assert.equal(r.parts_status.master_id,newMaster);assert.deepEqual(engine.sheets['События'].rows.slice(-3).map(x=>x['Действие']),['parts_required','parts_not_needed','update']);
});
test('returning an issued line restores stock without permitting manual replacements',async()=>{
 const h=fixture();await partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}]},h.context);
 const engine=createNativeEngine(h.sheets);const r=engine.run('update',{kind:'repair',id:repair,revision:2,status:'diagnostics',parts:[]},owner);assert.equal(r.parts.length,0);assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.equal(r.parts_status.mode,'pending');
});

test('returning TSD parts does not consume an older personal holding of the same SKU',async()=>{
 const h=fixture();h.seed('События',{'Тип':'warehouse','Действие':'master_issue','Детали':JSON.stringify({master_id:master,items:[{part_id:part,name:'Камера',quantity:3,unit_cost:50}]})});
 await partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}]},h.context);
 const engine=createNativeEngine(h.sheets),r=engine.run('update',{kind:'repair',id:repair,revision:2,status:'diagnostics',parts:[]},owner);
 assert.equal(r.parts.length,0);assert.equal(engine.sheets['Товары'].rows[0]['Остаток, шт.'],5);
 assert.ok(!engine.changes().some(x=>['master_stock_consume','master_stock_restore'].includes(x.values['Действие'])));
});


test('cash scanner issues into the repair once, without a sale or payment',async()=>{
 const h=fixture(),context={...h.context,device:{id:station,kind:'station'}},p={request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:2}]};
 const result=await partsIssue('parts_issue',p,context);assert.equal(result.items[0].quantity,2);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);
 assert.equal(h.sheets['Продажи'].rows.length,0);assert.equal(h.sheets['Оплаты'].rows.length,0);assert.deepEqual(await partsIssue('parts_issue',p,context),result);assert.equal(h.commits.length,1);
 const event=h.sheets['События'].rows.find(x=>x['Действие']==='parts_issued');assert.equal(JSON.parse(event['Детали']).scanner_source,'atol');
});

test('shared-queue pickup QR is signed for the current mechanic and exact repair without reassignment',async()=>{
 const h=fixture(),requester=randomUUID(),signed=await pickupCode({id:repair,requested_by:requester,pickup_scope:'repair_requester'},secret),ticket=await readPickupCode(signed.code,secret);
 assert.equal(ticket.scope,'repair_requester');assert.equal(ticket.requested_by,requester);assert.equal(ticket.master_id,undefined);
 const p={request_id:randomUUID(),items:[{part_id:part,quantity:1}]},issued=preparePartsIssue(h.snapshot(),p,ticket,owner);
 assert.equal(issued.result.repair_id,repair);assert.equal(issued.result.requested_by,requester);assert.equal(issued.result.master_id,undefined);assert.equal(h.raw.master_id,master);
 assert.equal(issued.changes.find(x=>x.sheet==='Ремонты').values.master_id,undefined);
 await assert.rejects(partsIssue('parts_pickup_quote',{code:signed.code},{...h.context,db:async(table,...args)=>table==='workshop_members'?[]:h.context.db(table,...args)}),/отключён/);
 const forged=signed.code.replace('FGPARTS1.','FGPARTS2.');await assert.rejects(readPickupCode(forged,secret));
});
