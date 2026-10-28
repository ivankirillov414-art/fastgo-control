import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
const id='eq-1234567890abcdef1234',owner={id:randomUUID(),role:'owner',name:'Владелец'};
function fixture(){
 const sheets={'События':{headers:['event_id','Дата','Тип','record_id','Действие','actor_id','Детали','updated_at'],rows:[]},'Товары':{headers:['product_id','Остаток, шт.','Цена закупки, ₽','Цена продажи, ₽'],rows:[{__row:2,product_id:randomUUID(),'Остаток, шт.':4,'Цена закупки, ₽':500,'Цена продажи, ₽':900}]}};
 return {sheets,engine:()=>createNativeEngine(sheets,{uuid:randomUUID,now:()=> '2026-10-28T18:00:00Z'}),apply(engine){for(const change of engine.changes()){const rows=sheets[change.sheet].rows;let old=rows.find(x=>x.__row===change.row);if(!old){old={__row:change.row};rows.push(old);}Object.assign(old,change.values);}}};
}
test('market estimate persists independently through the journal and backup snapshot',()=>{
 const f=fixture(),before=structuredClone(f.sheets['Товары']),engine=f.engine();
 const saved=engine.run('equipment_market_price_save',{id,revision:0,market_price:12345.67,request_id:randomUUID()},owner);assert.equal(saved.revision,1);f.apply(engine);
 assert.deepEqual(f.engine().run('equipment_market_prices',{}, {...owner,role:'seller'}).items,[saved]);assert.deepEqual(f.sheets['Товары'],before);assert.equal(f.sheets['События'].rows.length,1);
 const another=f.engine();assert.throws(()=>another.run('equipment_market_price_save',{id,revision:0,market_price:100,request_id:randomUUID()},owner),e=>e.status===409);assert.deepEqual(another.changes(),[]);
});
test('zero is an intentional estimate; reset keeps a revision and original history',()=>{
 const f=fixture();let e=f.engine();e.run('equipment_market_price_save',{id,revision:0,market_price:0,request_id:randomUUID()},owner);f.apply(e);assert.equal(f.engine().run('equipment_market_prices',{},owner).items[0].market_price,0);
 e=f.engine();e.run('equipment_market_price_save',{id,revision:1,market_price:null,request_id:randomUUID()},owner);f.apply(e);const record=f.engine().run('equipment_market_prices',{},owner).items[0];assert.equal(record.market_price,null);assert.equal(record.revision,2);assert.equal(f.sheets['События'].rows.length,2);
});
test('invalid values and unauthorized roles cannot append market-price events',()=>{
 const f=fixture(),params={id,revision:0,market_price:100,request_id:randomUUID()};
 for(const patch of [{id:'not-a-reference'},{request_id:''},{revision:-1},{revision:'0'},{market_price:'100'},{market_price:Infinity},{market_price:-1},{market_price:1.001},{market_price:100000001},{market_price:undefined}]){const e=f.engine();assert.throws(()=>e.run('equipment_market_price_save',{...params,...patch},owner));assert.deepEqual(e.changes(),[]);}
 for(const role of ['seller','manager','receiver','mechanic','customer'])assert.throws(()=>f.engine().run('equipment_market_price_save',params,{...owner,role}),e=>e.status===403);
 for(const role of ['mechanic','customer'])assert.throws(()=>f.engine().run('equipment_market_prices',{}, {...owner,role,can_sell:true}),e=>e.status===403);
 for(const role of ['developer','owner','admin'])assert.equal(f.engine().run('equipment_market_price_save',params,{...owner,role}).market_price,100);
});
import {nativeClient} from '../supabase/functions/_shared/native-client.js';
test('market price uses atomic native commit and resolves a lost reply through its receipt',async()=>{
 const actor={id:'11111111-1111-4111-8111-111111111111',role:'owner'},id='eq-1234567890abcdef1234',request_id='22222222-2222-4222-8222-222222222222';let version=1,receipt,commits=0,lose=true;
 const sheets={'События':{headers:['event_id','Дата','Тип','record_id','Действие','actor_id','Детали','updated_at'],rows:[]}};
 const db=async(table,q,method,p)=>{if(table==='rpc/workshop_native_snapshot')return structuredClone({version,sheets});if(table==='workshop_native_receipts')return receipt?[receipt]:[];assert.equal(table,'rpc/workshop_native_commit');assert.equal(p.p_action,'equipment_market_price_save');assert.equal(p.p_version,version);assert.equal(p.p_changes.length,1);assert.equal(p.p_changes[0].sheet,'События');commits++;for(const c of p.p_changes)sheets[c.sheet].rows.push({...c.values,__row:c.row});version++;receipt={actor_id:p.p_actor,action:p.p_action,fingerprint:p.p_fingerprint,result:p.p_result};if(lose){lose=false;throw Error('reply lost');}return {result:p.p_result};};
 const client=()=>nativeClient({db,actor,google:async()=>{throw Error('unexpected legacy write');},storage:{}}),params={id,request_id,revision:0,market_price:123.45,__request_fingerprint:'same'};
 await assert.rejects(client()('equipment_market_price_save',params),/reply lost/);const retry=await client()('operation_retry',{request_id,action:'equipment_market_price_save',fingerprint:'same'});assert.equal(retry.status,'committed');assert.equal(retry.result.market_price,123.45);assert.equal(commits,1);assert.equal((await client()('equipment_market_prices')).items.length,1);
});
