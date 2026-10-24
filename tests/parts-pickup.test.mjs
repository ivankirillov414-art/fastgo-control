import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {pickupCode,readPickupCode} from '../supabase/functions/_shared/parts-pickup-code.js';
import {partsIssue,preparePartsIssue} from '../supabase/functions/fastgo-warehouse/parts-issue.js';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
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
test('two terminals cannot consume the same pickup QR twice under a concurrent commit',async()=>{
 const h=fixture(),c=await code();const results=await Promise.allSettled([1,2].map(()=>partsIssue('parts_issue',{request_id:randomUUID(),code:c,items:[{part_id:part,quantity:1}]},h.context)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.commits.length,1);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],4);
});
test('closed/reassigned repairs, insufficient stock and laptop issue requests cause no writes',async()=>{
 for(const mode of ['closed','reassigned','stock','station']){const h=fixture();if(mode==='closed')h.raw['Статус']='Готов';if(mode==='reassigned')h.raw.master_id=randomUUID();const context=mode==='station'?{...h.context,device:{id:station,kind:'station'}}:h.context;
  await assert.rejects(partsIssue('parts_issue',{request_id:randomUUID(),code:await code(),items:[{part_id:part,quantity:mode==='stock'?6:1}]},context));assert.equal(h.commits.length,0);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],5);
 }
});
test('manual part insertion and forged issue fields are rejected; unchanged historic parts stay valid',()=>{
 const h=fixture(),p={kind:'repair',id:repair,revision:1,status:'diagnostics',parts:[{name:'Manual',part_id:part,price:0,quantity:1,tsd_issue_id:randomUUID()}]};
 assert.throws(()=>createNativeEngine(h.sheets).run('update',p,owner),/только через ТСД/);
 h.raw['Строки запчастей']=JSON.stringify(p.parts);const r=createNativeEngine(h.sheets).run('update',p,owner);assert.equal(r.parts.length,1);assert.equal(r.parts_status.mode,'issued');
});
test('ready requires TSD parts or explicit mechanic confirmation; confirmation is retained in audit',()=>{
 const h=fixture();Object.assign(h.raw,{'Статус':'В ремонте','Работы':'[]','Стоимость работ':0,'Итого':0});const p={kind:'repair',id:repair,revision:1,status:'ready',quality_checked:true};
 assert.throws(()=>createNativeEngine(h.sheets).run('update',p,{id:master,role:'mechanic'}),/Без замены/);
 const engine=createNativeEngine(h.sheets),ready=engine.run('update',{...p,no_parts:true},{id:master,role:'mechanic'});assert.equal(ready.status,'ready');assert.equal(ready.parts_status.mode,'none');assert.ok(engine.changes().some(x=>x.values['Действие']==='parts_not_needed'));
 assert.throws(()=>createNativeEngine(h.sheets).run('update',{...p,no_parts:true},{id:randomUUID(),role:'manager'}),/ставит мастер/);
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
