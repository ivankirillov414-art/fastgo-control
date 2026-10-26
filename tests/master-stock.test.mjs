import test from 'node:test';import {analytics} from '../supabase/functions/fastgo-operations/model.js';import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {nativeClient} from '../supabase/functions/_shared/native-client.js';
import {editInventory} from '../supabase/functions/fastgo-warehouse/inventory.js';
import {masterIssue,masterHoldings} from '../supabase/functions/fastgo-warehouse/model.js';
import {digest} from '../supabase/functions/fastgo-warehouse/handler.js';
const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));schema['Фото товаров']=['photo_id','product_id','category','path','created_at','sha256'];
async function fixture(){
 const state={version:1,sheets:Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}]))},receipts=[],owner={id:randomUUID(),role:'owner',email:'audit@example.invalid'},master={id:randomUUID(),role:'mechanic',email:'master@example.invalid'};let lose=false;
 state.sheets['Сотрудники'].rows.push({__row:2,employee_id:master.id,'ФИО':'Тестовый мастер','Роль':'Механик','Активен':true});
 function apply(changes){for(const c of changes){let row=state.sheets[c.sheet].rows.find(x=>x.__row===c.row);if(!row){row={__row:c.row};state.sheets[c.sheet].rows.push(row);}Object.assign(row,c.values);}state.version++;}
 const db=async(path,q,method,p)=>{if(path==='workshop_members')return new URLSearchParams(q).get('profile_id')==='eq.'+master.id?[{profile_id:master.id,name:'Тестовый мастер',role:'mechanic',active:true}]:[];if(path==='rpc/workshop_native_snapshot')return structuredClone(state);if(path==='workshop_native_receipts')return receipts.filter(x=>x.request_id===new URLSearchParams(q).get('request_id')?.slice(3));if(path==='rpc/workshop_native_commit'){const old=receipts.find(x=>x.request_id===p.p_request_id);if(old){assert.equal(old.actor_id,p.p_actor);assert.equal(old.fingerprint,p.p_fingerprint);return {result:old.result};}if(p.p_version!==state.version)return {retry:true};apply(p.p_changes);receipts.push({request_id:p.p_request_id,actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result});if(lose){lose=false;throw Error('Response lost after commit');}return {result:p.p_result};}throw Error(path);};
 const call=async(action,p={},actor=owner)=>{p={request_id:randomUUID(),...p};const g=nativeClient({db,actor,google:()=>{throw Error('Unexpected external backend');},storage:{}});const fingerprint=await digest(JSON.stringify({action,p}));const retry=await g('operation_retry',{request_id:p.request_id,action,fingerprint});return retry.status==='committed'?retry.result:g(action,{...p,__request_fingerprint:fingerprint});};
 const part=await call('part_save',{name:'Тестовая камера',category:'Тест',sku:'AUDIT-001',retail_price:300});
 const edit=(field,value,expected,actor=owner,p={},access={})=>editInventory({request_id:randomUUID(),part_id:part.id,field,value,expected,...p},{db,actor,device:{kind:'station'},digest,...access});
 await edit('quantity',5,0);
 const stock=()=>Number(state.sheets['Товары'].rows[0]['Остаток, шт.']);
 const repair=()=>call('create',{kind:'repair',last_name:'Тест',first_name:'Аудит',phone:'+70000000000',brand:'Test',model:'Unit'});
 const update=(r,parts,p={})=>call('update',{kind:'repair',id:r.id,revision:r.revision,status:'accepted',works:[],parts,discount:0,...p},master);
 const line={part_id:part.id,name:part.name,quantity:1,price:300};
 const issue=q=>{const r=masterIssue(state,{request_id:randomUUID(),master_id:master.id,items:[{part_id:part.id,quantity:q}]},owner,{validatedMaster:{profile_id:master.id,name:'Тестовый мастер'}});apply(r.changes);return r;};
 return {state,owner,master,part,call,edit,stock,repair,update,line,issue,holdings:()=>masterHoldings(state.sheets),lose:()=>lose=true,receipts};
}
const check=(name,fn)=>test(name,async()=>fn(await fixture()));
await check('Новая номенклатура имеет общий ID и штрихкод',async f=>{const c=await f.call('catalog',{},f.master),w=createNativeEngine(f.state.sheets).run('catalog',{},f.owner);assert.equal(c.parts[0].id,w.parts[0].id);assert.equal(c.parts[0].barcode,f.part.barcode);});
await check('Приход со склада виден мастеру',async f=>{await f.call('stock_receive',{items:[{part_id:f.part.id,quantity:3}],note:'TEST document'});assert.equal((await f.call('catalog',{},f.master)).parts[0].quantity,8);});
await check('Цена склада видна в мастерской',async f=>{await f.edit('retail_price',350,300);assert.equal((await f.call('catalog',{},f.master)).parts[0].retail_price,350);});
for(const method of ['cash','card','transfer'])await check('Продажа '+method+' отражается в кассе и складе',async f=>{const shift=await f.call('shift_open',{register:'TEST',opening_cash:0});const request_id=randomUUID();const p={request_id,shift_id:shift.id,payment_method:method,items:[{part_id:f.part.id,quantity:1}]};await f.call('sale',p);await f.call('sale',p);assert.equal(f.stock(),4);assert.equal((await f.call('cash_state',{shift_id:shift.id})).totals.count,1);});
await check('Потерянный ответ корректировки не создаёт повторное движение',async f=>{const request_id=randomUUID(),before=f.state.sheets['Движения склада'].rows.length;f.lose();await assert.rejects(f.edit('quantity',2,5,f.owner,{request_id}),/Response lost/);await f.edit('quantity',2,5,f.owner,{request_id});assert.equal(f.stock(),2);assert.equal(f.state.sheets['Движения склада'].rows.length,before+1);});
await check('Устаревший остаток не перезаписывает изменения другого клиента',async f=>{await f.edit('quantity',3,5);await assert.rejects(f.edit('quantity',7,5),e=>e.status===409);assert.equal(f.stock(),3);});
await check('Мастер не может править розничную цену',async f=>{await assert.rejects(f.edit('retail_price',1,300,f.master),e=>e.status===403);});
await check('Выдача мастеру не попадает в денежную выручку',async f=>{f.issue(2);assert.equal(f.stock(),3);assert.equal(f.holdings()[0].quantity,2);assert.equal(f.state.sheets['Оплаты'].rows.length,0);assert.equal(f.state.sheets['Продажи'].rows.length,0);});
await check('Возврат мастера уменьшает его остаток',async f=>{f.issue(2);await f.call('master_return',{master_id:f.master.id,part_id:f.part.id,quantity:1});assert.equal(f.stock(),4);assert.equal(f.holdings()[0].quantity,1,'Личный запас должен уменьшиться после возврата');});
await check('Аккаунт мастера без второй записи в справочнике доступен выдаче',async f=>{f.state.sheets['Сотрудники'].rows=[];f.issue(1);assert.equal(f.stock(),4);});

await check('Возврат сверх запаса запрещён без частичной записи',async f=>{f.issue(1);const version=f.state.version;await assert.rejects(f.call('master_return',{master_id:f.master.id,part_id:f.part.id,quantity:2}),e=>e.status===409);assert.equal(f.state.version,version);assert.equal(f.stock(),4);assert.equal(f.holdings()[0].quantity,1);});
await check('Повтор возврата после потерянного ответа выполняется один раз',async f=>{f.issue(2);const p={request_id:randomUUID(),master_id:f.master.id,part_id:f.part.id,quantity:1};f.lose();await assert.rejects(f.call('master_return',p),/Response lost/);await f.call('master_return',p);assert.equal(f.stock(),4);assert.equal(f.holdings()[0].quantity,1);});
await check('Мастер не может сам оформить складской возврат',async f=>{f.issue(2);await assert.rejects(f.call('master_return',{master_id:f.master.id,part_id:f.part.id,quantity:1},f.master),e=>e.status===403);assert.equal(f.stock(),3);});
await check('При назначении пользователь мастера берётся из единого справочника',async f=>{f.state.sheets['Сотрудники'].rows=[];const r=await f.call('create',{kind:'repair',last_name:'Тест',first_name:'Мастер',phone:'+70000000000',brand:'Test',model:'Unit',assigned_master_id:f.master.id});assert.equal(r.assigned_master_id,f.master.id);assert.equal(r.assigned_master,'Тестовый мастер');const saved=await f.update(r,[]);assert.equal(saved.assigned_master_id,f.master.id);assert.equal(f.state.sheets['Сотрудники'].rows.length,0);});
await check('Каталог показывает мастеру только его личный запас',async f=>{f.issue(2);const own=await f.call('catalog',{},f.master),other=await f.call('catalog',{},{id:randomUUID(),role:'mechanic'});assert.equal(own.master_holdings[0].quantity,2);assert.equal(other.master_holdings.length,0);});


await check('Ручное добавление в ремонт запрещено и не расходует старый запас мастера',async f=>{f.issue(2);const r=await f.repair(),version=f.state.version;await assert.rejects(f.update(r,[f.line]),e=>e.status===403);assert.equal(f.state.version,version);assert.equal(f.stock(),3);assert.equal(f.holdings()[0].quantity,2);});
await check('Историческая личная установка возвращается её владельцу без повторного складского списания',async f=>{f.issue(2);const r=await f.repair(),raw=f.state.sheets['Ремонты'].rows[0];raw['Строки запчастей']=JSON.stringify([{...f.line,master_allocations:[{master_id:f.master.id,quantity:1,unit_cost:100}]}]);f.state.sheets['События'].rows.push({__row:Math.max(...f.state.sheets['События'].rows.map(x=>x.__row))+1,'Тип':'warehouse','Действие':'master_stock_consume','Детали':JSON.stringify({master_id:f.master.id,items:[{part_id:f.part.id,name:f.part.name,quantity:1,unit_cost:100}]})});await f.call('update',{kind:'repair',id:r.id,revision:r.revision,status:'accepted',works:[],parts:[],discount:0},f.owner);assert.equal(f.stock(),3);assert.equal(f.holdings()[0].quantity,2);});

await check('Владелец корректирует цену и остаток с мобильного сайта без регистрации кассы',async f=>{
 const access={device:null,remote:true};await f.edit('quantity',7,5,f.owner,{},access);await f.edit('retail_price',1500.50,300,f.owner,{},access);
 assert.equal(f.stock(),7);assert.equal((await f.call('catalog')).parts[0].retail_price,1500.50);
 assert.equal(f.state.sheets['Движения склада'].rows.at(-1)['Тип'],'Корректировка');
 const version=f.state.version;for(const role of ['mechanic','seller','manager','receiver'])await assert.rejects(f.edit('quantity',8,7,{...f.owner,role},{},access),e=>e.status===403);
 assert.equal(f.state.version,version);await assert.rejects(f.edit('quantity',8,7,f.owner,{}, {device:null}),e=>e.status===403);
});

await check('Закупочная цена меняется отдельно от розницы с аудитом и повтором без дубля',async f=>{
 const access={device:null,remote:true},request_id=randomUUID(),movements=structuredClone(f.state.sheets['Движения склада'].rows);
 f.lose();await assert.rejects(f.edit('unit_cost',175.50,0,f.owner,{request_id},access),/Response lost/);
 const result=await f.edit('unit_cost',175.50,0,f.owner,{request_id},access);assert.equal(result.unit_cost,175.50);assert.equal(result.retail_price,300);assert.equal(result.quantity,5);
 assert.deepEqual(f.state.sheets['Движения склада'].rows,movements);assert.equal(f.state.sheets['События'].rows.filter(r=>r['Действие']==='purchase_price_update').length,1);
 await assert.rejects(f.edit('unit_cost',200,0,f.owner,{},access),e=>e.status===409);
 await assert.rejects(f.edit('unit_cost',-1,175.50,f.owner,{},access),e=>e.status===400);
 await assert.rejects(f.edit('unit_cost',200,175.50,f.master,{},access),e=>e.status===403);
});
await check('Карточка товарной техники сохраняет закупочную цену и историю изменения',async f=>{
 const part=await f.call('part_save',{name:'Kugoo Max Speed',category:'Техника · Электросамокаты',unit_cost:20000,retail_price:35000});
 const changed=await f.call('part_save',{id:part.id,name:part.name,unit_cost:22000.50,retail_price:35000});assert.equal(changed.unit_cost,22000.50);assert.equal(changed.retail_price,35000);
 const event=f.state.sheets['События'].rows.find(r=>r.record_id===part.id&&r['Действие']==='purchase_price_update');assert.equal(event.actor_id,f.owner.id);assert.equal(JSON.parse(event['Детали']).before,20000);
});

await check('Администратор каталога исправляет закупочную цену с телефона, мастер не получает это право',async f=>{
 const access={device:null,remote:true};const changed=await f.edit('unit_cost',100,0,{...f.owner,role:'admin'},{},access);assert.equal(changed.unit_cost,100);assert.equal(changed.retail_price,300);
 await assert.rejects(f.edit('unit_cost',1,100,{...f.master,can_sell:true,can_edit_catalog:true},{},access),e=>e.status===403);
});
