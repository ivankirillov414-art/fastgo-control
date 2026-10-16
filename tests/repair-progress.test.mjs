import test from 'node:test';
import assert from 'node:assert/strict';
import {repairActions,repairRequirements} from '../workshop/repair-progress.js';

test('next repair actions advance after saving and retain role permissions',()=>{
 assert.deepEqual(repairActions('accepted',{}),['diagnostics']);
 assert.ok(repairActions('diagnostics',{}).includes('repair'));
 assert.ok(repairActions('repair',{can_mark_ready:true}).includes('ready'));
 assert.equal(repairActions('repair',{}).includes('ready'),false);
 assert.deepEqual(repairActions('issued',{can_mark_ready:true,can_issue:true}),[]);
});
test('empty parts and a customer part permit completion after approval and quality',()=>{
 const values={status:'ready',works:[{price:600,quantity:1}],parts:[],diagnostics_notes:'Прокол камеры',quality_checked:true};
 assert.deepEqual(repairRequirements({approved_amount:600},values),[]);
 values.parts.push({name:'Камера клиента',price:0,quantity:1});
 assert.deepEqual(repairRequirements({approved_amount:600},values),[]);
});
test('missing and stale approval cannot pass through NaN comparisons',()=>{
 const values={status:'repair',works:[{price:600,quantity:1}],parts:[],diagnostics_notes:'Проверено'};
 for(const approved_amount of [undefined,null,'','oops',500])assert.deepEqual(repairRequirements({approved_amount},values),['approval']);
 assert.deepEqual(repairRequirements({approved_amount:null},{...values,approve:true,approval_note:'Согласовано'}),[]);
 assert.deepEqual(repairRequirements({approved_amount:600},{...values,approve:true,approval_note:' '}),['approval']);
});
