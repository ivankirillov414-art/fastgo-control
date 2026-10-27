import test from 'node:test';
import assert from 'node:assert/strict';
import {repairActions,repairRequirements,repairPartsCondition,repairNoPartsAllowed} from '../workshop/repair-progress.js';

test('next repair actions advance after saving and retain role permissions',()=>{
 assert.deepEqual(repairActions('accepted',{}),['diagnostics']);
 assert.ok(repairActions('diagnostics',{}).includes('repair'));
 assert.ok(repairActions('repair',{can_mark_ready:true}).includes('ready'));
 assert.equal(repairActions('repair',{}).includes('ready'),false);
 assert.deepEqual(repairActions('issued',{can_mark_ready:true,can_issue:true}),[]);
});
test('completion requires saved repair parts or an explicit no-parts confirmation',()=>{
 const values={status:'ready',works:[{price:600,quantity:1}],parts:[],diagnostics_notes:'Прокол камеры',quality_checked:true};
 assert.deepEqual(repairRequirements({approved_amount:600},values),['parts']);
 assert.deepEqual(repairRequirements({approved_amount:600},{...values,no_parts:true}),[]);
 values.parts.push({name:'Камера клиента',price:0,quantity:1});
 assert.deepEqual(repairRequirements({approved_amount:600},values),['parts']);
 const part={name:'Камера',part_id:'saved-part',price:100,quantity:2,tsd_issue_id:'issued'};
 assert.equal(repairPartsCondition({parts:[part],parts_status:{mode:'issued'}},{parts:[part]}).mode,'issued');
 assert.equal(repairPartsCondition({parts:[{...part,tsd_issue_id:undefined}],parts_status:{mode:'legacy'}}).mode,'issued');
 assert.equal(repairPartsCondition({parts:[{id:'old-product-id',name:'Старая выданная деталь',quantity:1,price:0}],parts_status:{mode:'legacy'}}).mode,'issued');
});

test('proposed, empty, zero, fractional and unnamed stock rows cannot prove repair issue',()=>{
 const valid={part_id:'saved-part',quantity:1,price:0};
 assert.equal(repairPartsCondition({parts:[]},{parts:[valid]}).mode,'pending');
 for(const part of [{name:'Клиентская камера',quantity:1},{...valid,quantity:0},{...valid,quantity:-1},{...valid,quantity:.5},{...valid,quantity:true},{...valid,quantity:Number.MAX_SAFE_INTEGER+1},{...valid,quantity:'oops'},{...valid,part_id:''}]){
  assert.equal(repairPartsCondition({parts:[part],parts_status:{mode:'issued'}}).mode,'pending');
  assert.equal(repairPartsCondition({parts:[part]},{no_parts:true}).mode,'none');
 }
 assert.equal(repairPartsCondition({parts:[valid]},{parts:[]}).mode,'pending');
 assert.equal(repairPartsCondition({parts:[valid]},{parts:[{...valid,quantity:2}]}).mode,'pending');
});

test('saved no-parts applies only until explicit revocation, reassignment or reopening',()=>{
 const record={assigned_master_id:'master',parts:[],parts_status:{mode:'none'}};
 assert.equal(repairPartsCondition(record).mode,'none');
 for(const values of [{no_parts:false},{assigned_master_id:'other'},{reopen_reason:'Новый цикл'}])assert.equal(repairPartsCondition(record,values).mode,'pending');
 assert.equal(repairPartsCondition(record,{no_parts:true}).mode,'none');
});

test('only a new completion transition requires parts; historical notes and cancellation do not',()=>{
 const base={works:[],parts:[],diagnostics_notes:'Проверено',quality_checked:true,approved_amount:0,handover_notes:'Комплектно'};
 for(const status of ['ready','issued'])assert.deepEqual(repairRequirements({...base,status},{...base,status}),[]);
 assert.deepEqual(repairRequirements({...base,status:'repair'},{...base,status:'ready'}),['parts']);
 assert.deepEqual(repairRequirements({...base,status:'ready'},{...base,status:'issued'}),['parts']);
 assert.deepEqual(repairRequirements({...base,status:'repair'},{...base,status:'cancelled',note:'Клиент отказался'}),[]);
});

test('the assigned mechanic and owners may confirm; another employee cannot',()=>{
 const record={assigned_master_id:'master'};
 assert.equal(repairNoPartsAllowed(record,{profile_id:'master',role:'mechanic'}),true);
 assert.equal(repairNoPartsAllowed(record,{profile_id:'other',role:'mechanic'}),false);
 assert.equal(repairNoPartsAllowed(record,{profile_id:'cashier',role:'receiver'}),false);
 assert.equal(repairNoPartsAllowed(record,{profile_id:'owner',role:'owner'}),true);
 assert.equal(repairNoPartsAllowed({}, {profile_id:'master',role:'mechanic'}),true);
});
test('missing and stale approval cannot pass through NaN comparisons',()=>{
 const values={status:'repair',works:[{price:600,quantity:1}],parts:[],diagnostics_notes:'Проверено'};
 for(const approved_amount of [undefined,null,'','oops',500])assert.deepEqual(repairRequirements({approved_amount},values),['approval']);
 assert.deepEqual(repairRequirements({approved_amount:null},{...values,approve:true,approval_note:'Согласовано'}),[]);
 assert.deepEqual(repairRequirements({approved_amount:600},{...values,approve:true,approval_note:' '}),['approval']);
});
