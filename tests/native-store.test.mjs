import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {nativeClient} from '../supabase/functions/_shared/native-client.js';
const owner={id:'11111111-1111-4111-8111-111111111111',role:'owner',email:'owner@example.invalid'},manager={id:'22222222-2222-4222-8222-222222222222',role:'manager',email:'manager@example.invalid'},part='33333333-3333-4333-8333-333333333333';
function harness(){
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));schema['Фото товаров']=['photo_id','product_id','category','path','created_at','sha256'];schema['Операции API']=['request_id','actor_id','action','fingerprint','result','created_at'];
 let version=1,googleCalls=0,failResponse=false;const sheets=Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}])),receipts=new Map(),outbox=[];
 const seed=(name,obj)=>sheets[name].rows.push({...Object.fromEntries(sheets[name].headers.map(k=>[k,''])),...obj,__row:sheets[name].rows.length+2});
 seed('Товары',{product_id:part,'Модель / название':'Тест','Категория':'Тест','Штрих-код':'FGP-00000001','Остаток, шт.':1,'Цена продажи, ₽':100,'Активен':true});seed('Категории',{'Категория (ключ)':'Тест'});
 const db=async(table,q,method,p)=>{
  if(table==='rpc/workshop_native_snapshot')return structuredClone({version,sheets});
  if(table==='workshop_native_receipts'){const id=new URLSearchParams(q).get('request_id').slice(3);return receipts.has(id)?[receipts.get(id)]:[];}
  if(table!=='rpc/workshop_native_commit')throw Error(table);
  const old=receipts.get(p.p_request_id);if(old){if(old.actor_id!==p.p_actor||old.fingerprint!==p.p_fingerprint)throw Error('request mismatch');return {result:old.result};}
  if(p.p_version!==version)return {retry:true};
  for(const c of p.p_changes){let row=sheets[c.sheet].rows.find(x=>x.__row===c.row);if(!row){row={__row:c.row};sheets[c.sheet].rows.push(row);}Object.assign(row,c.values);}
  version++;receipts.set(p.p_request_id,{actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});outbox.push(p.p_changes);
  if(failResponse){failResponse=false;throw Error('response lost');}return {result:p.p_result};
 };
 const client=actor=>nativeClient({db,actor,google:async()=>{googleCalls++;throw Error('Google unavailable');},storage:{put:async()=>{},sign:async p=>'signed:'+p}});
 const call=async(action,p={},actor=owner)=>{const g=client(actor);if(['storage_close','storage_delete','create','update','stock','sale','payment','part_photo_upload','upload'].includes(action)){p={kind:'repair',request_id:randomUUID(),...p};p.__request_fingerprint=createHash('sha256').update(JSON.stringify(p)).digest('hex');const old=await g('operation_retry',{request_id:p.request_id,action,fingerprint:p.__request_fingerprint});if(old.status==='committed')return old.result;}return g(action,p);};
 return {call,sheets,seed,outbox,receipts,googleCalls:()=>googleCalls,failResponse:()=>failResponse=true};
}
const intake=()=>({kind:'repair',last_name:'Тест',first_name:'Приёмка',phone:'+70000000000',brand:'Test',model:'Unit'});
test('all primary screens read Postgres while Google is unavailable',async()=>{const h=harness();for(const action of ['catalog','overview','customers','list','finance','legal','sales'])await h.call(action);assert.equal(h.googleCalls(),0);});
test('repair intake, stock usage, approval, payment and issue work without Google',async()=>{
 const h=harness(),r=await h.call('create',intake());const details={kind:'repair',id:r.id,revision:r.revision,status:'repair',works:[{name:'Диагностика',price:200,quantity:1}],parts:[{part_id:part,name:'Запчасть',price:100,quantity:1}],discount:0};
 const fixed=await h.call('update',details);const ready=await h.call('update',{...details,revision:fixed.revision,status:'ready',approve:true,approval_note:'Согласовано',quality_checked:true});
 await h.call('payment',{kind:'repair',id:r.id,amount:300,method:'cash'});const paid=(await h.call('get',{kind:'repair',id:r.id})).record;
 await h.call('update',{...details,revision:paid.revision,status:'issued',quality_checked:true});assert.equal((await h.call('get',{kind:'repair',id:r.id})).record.status,'issued');assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],0);assert.equal(h.outbox.length,5);assert.equal(h.googleCalls(),0);
});
test('two simultaneous sales of the last unit result in one sale and one outbox job',async()=>{
 const h=harness(),p={payment_method:'cash',items:[{part_id:part,quantity:1}]};const results=await Promise.allSettled([h.call('sale',p),h.call('sale',p,manager)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.sheets['Продажи'].rows.length,1);assert.equal(h.outbox.length,1);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],0);
});
test('a lost response replays the committed receipt without a second stock write',async()=>{
 const h=harness(),p={request_id:randomUUID(),part_id:part,movement_type:'receipt',quantity:2,note:'test'};h.failResponse();await assert.rejects(h.call('stock',p),/response lost/);await h.call('stock',p);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal(h.outbox.length,1);
});
test('mechanic cannot view an unrelated repair or change warehouse balance',async()=>{
 const h=harness(),r=await h.call('create',intake()),mechanic={...manager,role:'mechanic'};await assert.rejects(h.call('get',{id:r.id},mechanic),/доступ/i);await assert.rejects(h.call('stock',{part_id:part,quantity:1,movement_type:'receipt'},mechanic),/доступ/i);
});
test('new private photos can be selected and viewed while Google is unavailable',async()=>{
 const h=harness();const uploaded=await h.call('part_photo_upload',{part_id:part,content_type:'image/png',content_base64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'),primary_for_category:true});assert.ok(uploaded.path.startsWith('native:'));const photo=await h.call('part_photo_url',{part_id:part});assert.ok(photo.url.startsWith('signed:'));assert.equal(h.googleCalls(),0);assert.equal(h.outbox.length,1);
});

const receiver={...manager,role:'receiver',name:'Приёмщик'};
test('only receiver can close or delete storage; legal settings are owner-only',async()=>{
 const h=harness(),r=await h.call('create',{...intake(),kind:'storage'});
 for(const role of ['owner','admin','manager','mechanic']){
  for(const action of ['storage_close','storage_delete'])await assert.rejects(h.call(action,{kind:'storage',id:r.id,revision:r.revision,note:'test'},{...manager,role}),/мастеру-приёмщику/);
 }
 for(const role of ['admin','receiver','manager','mechanic']){
  await assert.rejects(h.call('legal',{}, {...manager,role}),/владельцу/);
  await assert.rejects(h.call('legal_save',{legal_name:'test'},{...manager,role}),/владельцу/);
 }
 assert.equal(h.outbox.length,1);
});
test('storage close rejects debt, then completes and logs verified actor',async()=>{
 const h=harness(),r=await h.call('create',{...intake(),kind:'storage'});
 await assert.rejects(h.call('storage_close',{kind:'storage',id:r.id,revision:r.revision,note:'Выдано'},receiver),/оплатите/);
 await h.call('payment',{kind:'storage',id:r.id,amount:r.storage_amount,method:'cash'});
 const paid=(await h.call('get',{kind:'storage',id:r.id})).record;
 const result=await h.call('storage_close',{kind:'storage',id:r.id,revision:paid.revision,note:'Выдано'},receiver);
 assert.equal(result.status,'returned');
 assert.equal((await h.call('list',{kind:'storage',status:'active'})).count,0);
 const events=(await h.call('get',{kind:'storage',id:r.id})).events;
 assert.equal(events.find(e=>e.action==='storage_close').actor_id,receiver.id);
});
test('storage deletion retains payments and audit, hides records, fences stale and duplicate writes',async()=>{
 const h=harness(),r=await h.call('create',{...intake(),kind:'storage'});
 await h.call('payment',{kind:'storage',id:r.id,amount:100,method:'cash'});
 await assert.rejects(h.call('storage_delete',{kind:'storage',id:r.id,revision:r.revision,note:'Ошибка'},receiver),/изменена/);
 const paid=(await h.call('get',{kind:'storage',id:r.id})).record;
 const params={kind:'storage',id:r.id,revision:paid.revision,note:'Ошибка приёмки',request_id:randomUUID()};
 h.failResponse();await assert.rejects(h.call('storage_delete',params,receiver),/response lost/);
 await h.call('storage_delete',params,receiver);
 assert.equal((await h.call('list',{kind:'storage',status:'all'})).count,0);
 assert.equal((await h.call('overview')).storage,0);
 assert.equal((await h.call('finance')).total,100);
 const d=await h.call('get',{kind:'storage',id:r.id});
 const events=d.events.filter(e=>e.action==='storage_delete');
 assert.equal(events.length,1);assert.equal(events[0].actor_id,receiver.id);
 assert.equal(d.record.status,'deleted');
 await assert.rejects(h.call('update',{kind:'storage',id:r.id,revision:d.record.revision,status:'stored',reopen_reason:'restore'}),/удалена/);
});
