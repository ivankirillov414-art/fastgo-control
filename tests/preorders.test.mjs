import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {nativeClient} from '../supabase/functions/_shared/native-client.js';
const owner={id:randomUUID(),name:'Кассир',role:'owner'},seller={id:randomUUID(),role:'seller'},part=randomUUID(),vehicle=randomUUID();
function fixture(){const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([name,headers])=>[name,{headers,rows:[]}]));
 sheets['Товары'].rows=[{__row:2,product_id:part,'Модель / название':'Камера 10 × 2,5','Артикул / SKU':'FGP-038','Категория':'Камеры','Активен':true,'Остаток, шт.':10},{__row:3,product_id:vehicle,'Модель / название':'Kugoo M4','Категория':'Техника · Электросамокаты','Активен':true}];
 sheets['Клиенты'].rows=[{__row:2,client_id:randomUUID(),'ФИО':'Иванов Иван Иванович','Телефон':'+79991234567'}];
 return {sheets,params:{id:randomUUID(),request_id:randomUUID(),last_name:'Иванов',first_name:'Иван',middle_name:'Иванович',phone:'8 (999) 123-45-67',items:[{name:'Камера',kind:'part',product_id:part,quantity:2},{name:'Новая модель под заказ',kind:'equipment',quantity:1}],prepayment:1500.25,expected_on:'2026-11-05'},engine:()=>createNativeEngine(sheets,{now:()=> '2026-10-23T20:15:00.000Z',uuid:randomUUID}),apply(changes){for(const c of changes){const rows=sheets[c.sheet].rows,old=rows.find(r=>r.__row===c.row);if(old)Object.assign(old,c.values);else rows.push({__row:c.row,...c.values});}}};}
test('preorders persist client, catalog and custom items through the existing replica journal without changing stock or cash',()=>{
 const f=fixture(),engine=f.engine(),record=engine.run('preorder_save',f.params,owner);assert.equal(record.number,'ПЗ-000001');assert.equal(record.phone,'+79991234567');assert.equal(record.items[0].name,'Камера 10 × 2,5');assert.equal(record.items[1].product_id,null);assert.equal(record.prepayment,1500.25);
 assert.deepEqual(engine.changes().map(c=>c.sheet),['События']);f.apply(engine.changes());const fresh=f.engine(),list=fresh.run('preorders',{},seller);assert.equal(list.count,1);assert.equal(list.prepayment_total,1500.25);assert.equal(f.sheets['Товары'].rows[0]['Остаток, шт.'],10);assert.equal(f.sheets['Оплаты'].rows.length,0);assert.equal(fresh.run('preorders',{from:'2026-10-24',to:'2026-10-24'},owner).count,1);
 assert.equal(fresh.run('preorder_suggestions',{search:'куг',kind:'equipment'},owner)[0].id,vehicle);assert.equal(fresh.run('preorder_suggestions',{search:'Иван',kind:'customer'},owner).length,1);assert.equal(fresh.run('preorder_suggestions',{search:'99',kind:'customer'},seller).length,1);
});
test('edits require the current revision; closing retains the entire history and prepayment in the archive',()=>{
 const f=fixture(),first=f.engine(),record=first.run('preorder_save',f.params,seller);f.apply(first.changes());const edit=f.engine(),saved=edit.run('preorder_save',{...record,request_id:randomUUID(),status:'issued',prepayment:2000,revision:1},owner);f.apply(edit.changes());assert.equal(saved.number,record.number);assert.equal(saved.revision,2);assert.equal(f.engine().run('preorders',{},owner).count,0);
 const archive=f.engine().run('preorders',{status:'archive',search:'Камера'},owner);assert.equal(archive.count,1);assert.equal(archive.items[0].prepayment,2000);const full=f.engine().run('preorder_get',{id:record.id},owner);assert.equal(full.history_count,2);assert.equal(full.history[1].prepayment,1500.25);assert.equal(full.history[0].actor_name,'Кассир');
 assert.throws(()=>f.engine().run('preorder_save',{...record,request_id:randomUUID(),revision:1},owner),e=>e.status===409);assert.equal(f.sheets['События'].rows.length,2);
});
test('invalid money, quantities, phone and dates cannot append a record; roles cannot read client data without permission',()=>{
 const f=fixture();for(const change of [{prepayment:-1},{prepayment:1.001},{prepayment:'100'},{prepayment:Infinity},{phone:'123'},{expected_on:'2026-02-31'},{items:[]},{items:[{name:'Камера',kind:'part',quantity:0}]}]){const e=f.engine();assert.throws(()=>e.run('preorder_save',{...f.params,...change},owner));assert.deepEqual(e.changes(),[]);}
 for(const action of ['preorders','preorder_get','preorder_suggestions','preorder_save'])assert.throws(()=>f.engine().run(action,f.params,{id:randomUUID(),role:'mechanic'}),e=>e.status===403);
 assert.equal(f.engine().run('preorders',{}, {...seller,role:'mechanic',can_sell:true}).count,0);
});
test('historical catalog items remain editable after the product is disabled, while new orders cannot select it',()=>{
 const f=fixture(),e=f.engine(),record=e.run('preorder_save',f.params,owner);f.apply(e.changes());f.sheets['Товары'].rows[0]['Активен']=false;
 const updated=f.engine().run('preorder_save',{...record,request_id:randomUUID(),revision:1,status:'cancelled'},owner);assert.equal(updated.items[0].name,record.items[0].name);assert.throws(()=>f.engine().run('preorder_save',{...f.params,id:randomUUID(),request_id:randomUUID()},owner),/отключён/);
});
test('native transaction retries preserve distinct numbering and replay a committed response after a lost connection',async()=>{
 const f=fixture(),receipts=new Map();let version=1,conflict=true,loseResponse=true;
 const db=async(table,q,method,p)=>{
  if(table==='rpc/workshop_native_snapshot')return {sheets:structuredClone(f.sheets),version};
  if(table==='workshop_native_receipts'){const id=new URLSearchParams(q).get('request_id')?.slice(3);return receipts.has(id)?[receipts.get(id)]:[];}
  if(table==='rpc/workshop_native_commit'){
   if(conflict){conflict=false;const other=f.engine();other.run('preorder_save',{...f.params,id:randomUUID(),request_id:randomUUID()},seller);f.apply(other.changes());version++;return {retry:true};}
   assert.equal(p.p_version,version);f.apply(p.p_changes);version++;receipts.set(p.p_request_id,{actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});if(loseResponse){loseResponse=false;throw Error('Connection lost after commit');}return {result:p.p_result};
  }throw Error('Unexpected '+table);
 };
 const p={...f.params,__request_fingerprint:'a'.repeat(64)},client=()=>nativeClient({db,actor:owner,google:()=>{throw Error('Primary writes cannot use the mirror');}});
 await assert.rejects(()=>client()('preorder_save',p),/Connection lost/);const retry=await client()('operation_retry',{request_id:p.request_id,action:'preorder_save',fingerprint:p.__request_fingerprint});assert.equal(retry.result.number,'ПЗ-000002');assert.equal(retry.status,'committed');assert.equal(f.engine().run('preorders',{},owner).count,2);assert.equal(receipts.size,1);
});
