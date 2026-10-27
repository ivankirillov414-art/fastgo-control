const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{Store}=require('../store.cjs');
const actor='repair-mechanic',part={part_id:'catalog-part',name:'Амортизатор',quantity:2,price:1500};
function fixture(t,extra={},role='mechanic'){
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-parts-required-')),'FastGo.sqlite'),f={file,store:new Store(file)};
 const record={id:'repair',revision:1,status:'repair',assigned_master_id:actor,parts:[],works:[],diagnostics_notes:'Проверено',quality_checked:true,total_amount:0,...extra};
 f.store.cache(actor,'me',{role});f.store.remember(actor,'repair',record);f.write=p=>f.store.localWrite(actor,'update',{kind:'repair',id:record.id,...p});t.after(()=>f.store.close());return f;
}
test('offline completion rejects missing or invalid stored stock lines without queueing a mutation',t=>{
 for(const parts of [[],[{name:'Камера клиента',quantity:1,price:0}],[{...part,quantity:0}],[{...part,quantity:-1}],[{...part,quantity:.5}],[{...part,quantity:true}],[{...part,quantity:Number.MAX_SAFE_INTEGER+1}],[{...part,part_id:''}]]){
  const f=fixture(t,{parts,parts_status:{mode:'issued'}});assert.throws(()=>f.write({status:'ready'}),/Ремонт без запчастей/);assert.equal(f.store.pending(actor).length,0);assert.equal(f.store.record(actor,'repair','repair').status,'repair');
 }
});
test('existing issued and legacy allocations permit completion without a second stock issue',t=>{
 for(const line of [part,{...part,tsd_issue_id:'already-issued'},{id:'legacy-product-id',name:'Ранее выданная деталь',quantity:1,price:0}]){const f=fixture(t,{parts:[line],parts_status:{mode:line.tsd_issue_id?'issued':'legacy'}}),ready=f.write({status:'ready',parts:[line]});assert.equal(ready.status,'ready');assert.deepEqual(ready.parts,[line]);assert.equal(f.store.pending(actor).length,1);assert.equal(f.store.pending(actor)[0].action,'update');}
});
test('incoming invented stock lines are not proof of issue',t=>{
 const f=fixture(t);assert.throws(()=>f.write({status:'ready',parts:[part]}),/только через ТСД/);assert.equal(f.store.pending(actor).length,0);
});
test('explicit no-parts confirmation is durable for a repair with a customer-supplied line',t=>{
 const line={name:'Камера клиента',quantity:1,price:0},f=fixture(t,{parts:[line]});const ready=f.write({status:'ready',no_parts:true});assert.equal(ready.parts_status.mode,'none');assert.deepEqual(ready.parts,[line]);f.store.close();f.store=new Store(f.file);assert.equal(f.store.record(actor,'repair','repair').parts_status.mode,'none');assert.equal(f.store.pending(actor)[0].params.no_parts,true);
});
test('explicit false revokes an old confirmation across intermediate save and restart',t=>{
 const f=fixture(t,{parts_status:{mode:'none'}});assert.throws(()=>f.write({status:'ready',no_parts:false}),/Ремонт без запчастей/);assert.equal(f.store.pending(actor).length,0);
 const saved=f.write({status:'repair',no_parts:false});assert.equal(saved.parts_status.mode,'pending');f.store.close();f.store=new Store(f.file);assert.equal(f.store.record(actor,'repair','repair').parts_status.mode,'pending');assert.throws(()=>f.write({status:'ready'}),/Ремонт без запчастей/);assert.equal(f.store.pending(actor).length,1);
});
test('historical ready edits remain possible but ready-to-issued and reopened completion recheck',t=>{
 const f=fixture(t,{status:'ready'});assert.equal(f.write({diagnostics_notes:'Уточнение'}).status,'ready');assert.throws(()=>f.write({status:'issued'}),/Ремонт без запчастей/);
 const old=fixture(t,{status:'issued',parts_status:{mode:'none'}},'owner');const reopened=old.write({status:'accepted',reopen_reason:'Доработка'});assert.equal(reopened.parts_status.mode,'pending');assert.throws(()=>old.write({status:'ready'}),/Ремонт без запчастей/);
 const cancelled=fixture(t);assert.equal(cancelled.write({status:'cancelled',note:'Клиент отказался'}).status,'cancelled');
});
test('saved confirmation belongs to the same master and cannot be forged by another employee',t=>{
 const f=fixture(t,{parts_status:{mode:'none'}});assert.throws(()=>f.write({status:'ready',assigned_master_id:'other'}),/Ремонт без запчастей/);
 const cash=fixture(t,{assigned_master_id:'other'},'receiver');assert.throws(()=>cash.write({status:'ready',no_parts:true}),/ставит мастер/);
 const recorded=fixture(t,{assigned_master_id:'other',parts_status:{mode:'none'}},'receiver');assert.equal(recorded.write({status:'ready'}).status,'ready');assert.equal(Object.hasOwn(recorded.store.pending(actor)[0].params,'no_parts'),false);
});
test('reopen requires a closed repair, administrator, reason and accepted target',t=>{
 const mechanic=fixture(t,{status:'issued',parts_status:{mode:'none'}});assert.throws(()=>mechanic.write({status:'accepted',reopen_reason:'Не даёт мастерских прав'}),/Заказ закрыт/);assert.equal(mechanic.store.pending(actor).length,0);
 const owner=fixture(t,{status:'issued',parts_status:{mode:'none'}},'owner');for(const p of [{status:'accepted'},{status:'accepted',reopen_reason:' '},{status:'ready',reopen_reason:'Не тот этап'}])assert.throws(()=>owner.write(p),/Заказ закрыт/);assert.equal(owner.store.pending(actor).length,0);
 const reopened=owner.write({status:'accepted',reopen_reason:'Доработка после выдачи'});assert.equal(reopened.status,'accepted');assert.equal(reopened.parts_status.mode,'pending');assert.equal(owner.store.pending(actor).length,1);
});
