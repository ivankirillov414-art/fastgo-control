import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID,createHash} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';
import {prepareRepairPayment} from '../supabase/functions/fastgo-warehouse/repair.js';
import {preparePaymentCorrection,paymentCorrectionPreview,paymentCorrections} from '../supabase/functions/fastgo-warehouse/payment-corrections.js';
import {finalReport} from '../supabase/functions/fastgo-warehouse/final-report.js';
import {owner,fixture,paidRepair} from './payment-correction-fixture.mjs';
test('void the mistaken transfer purchase while preserving the later cash purchase and exact stock',()=>{
 const h=fixture(),wrong=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]}),right=h.run('sale',{shift_id:h.shift,payment_method:'cash',items:[{part_id:h.b,quantity:2}]});
 assert.equal(h.stock(h.a),4);assert.equal(h.stock(h.b),5);
 h.correct('sale:'+wrong.id);assert.equal(h.stock(h.a),5);assert.equal(h.stock(h.b),5);
 const report=h.report();assert.equal(report.total,700);assert.equal(report.groups.find(g=>g.method==='transfer').total,0);assert.equal(report.groups.find(g=>g.method==='cash').total,700);
 assert.equal(report.groups.flatMap(g=>g.items).find(x=>x.id==='sale:'+wrong.id).operation.state,'cancelled');assert.equal(report.groups.flatMap(g=>g.items).find(x=>x.id==='sale:'+right.id).operation.can_correct,true);
 assert.equal(h.sheets['Продажи'].rows.find(x=>x.sale_id===wrong.id)['Итого'],100,'original amount remains auditable');assert.equal(h.sheets['Продажи'].rows.find(x=>x.sale_id===wrong.id)['Статус'],'Отменена');
 assert.throws(()=>h.correct('sale:'+wrong.id),/уже отменена/);assert.equal(h.stock(h.a),5);
});
test('edit amount and method without moving goods, then void only the current replacement once',()=>{
 const h=fixture(),sale=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]});
 const edited=h.correct('sale:'+sale.id,{mode:'edit',amount:125.45,method:'cash'});assert.equal(h.stock(h.a),4);assert.equal(h.report().total,125.45);assert.equal(h.report().groups.find(g=>g.method==='transfer').total,0);
 assert.equal(h.sheets['Движения склада'].rows.length,1);assert.throws(()=>h.correct('sale:'+sale.id),/уже отменена или исправлена/);
 h.correct(edited.replacement_operation_id);assert.equal(h.stock(h.a),5);assert.equal(h.report().total,0);assert.equal(h.sheets['Движения склада'].rows.length,2);
});
test('manual work payment and sale stay linked and are counted once through edit and cancellation',()=>{
 const h=fixture(),sale=h.run('sale',{register:'Касса',service_items:[{title:'Работа',quantity:1,unit_price:500}],items:[],payment_method:'transfer'}),payment=h.sheets['Оплаты'].rows.find(x=>x.record_id===sale.id);
 const edited=h.correct('payment:'+payment.payment_id,{mode:'edit',amount:450,method:'card'});assert.equal(h.report().total,450);assert.equal(h.report().groups.find(g=>g.method==='card').total,450);assert.equal(h.sheets['Движения склада'].rows.length,0);
 assert.throws(()=>h.correct('sale:'+sale.id),/уже отменена/);h.correct(edited.replacement_operation_id);assert.equal(h.report().total,0);assert.equal(h.sheets['Движения склада'].rows.length,0);
});
test('void a repair payment recalculates balance and reopens payment with a new completion key',()=>{
 const h=fixture(),{record,payment}=paidRepair(h);const result=h.correct('payment:'+payment.payment_id);
 assert.equal(result.paid_after,0);assert.equal(result.record_status,'ready');assert.equal(result.repair_completed,false);
 const after=h.run('get',{kind:'repair',id:record.id}).record;assert.equal(after.paid_amount,0);assert.notEqual(after.step_state.completion_request_id,record.step_state.completion_request_id);assert.equal(h.report().total,0);
 assert.equal(h.sheets['Оплаты'].rows[0]['Сумма'],1000);assert.equal(h.sheets['Оплаты'].rows[1]['Сумма'],-1000);
});
test('void the old repair transfer keeps an already entered correct cash payment and issued state',()=>{
 const h=fixture(),{record,payment}=paidRepair(h);h.seed('Оплаты',{payment_id:randomUUID(),'Дата':new Date().toISOString(),'Тип':'repair',record_id:record.id,'Сумма':1000,'Способ оплаты':'cash',request_id:randomUUID()});const raw=h.sheets['Ремонты'].rows.find(x=>x.repair_id===record.id);raw['Оплачено']=2000;
 const result=h.correct('payment:'+payment.payment_id);assert.equal(result.paid_after,1000);assert.equal(result.record_status,'issued');assert.equal(h.run('get',{kind:'repair',id:record.id}).record.step_state.completion_request_id,record.step_state.completion_request_id);assert.equal(h.report().total,1000);assert.equal(h.report().groups.find(g=>g.method==='cash').total,1000);
});
test('an amount correction completing a prepared repair is eligible for the same atomic act outbox',()=>{
 const h=fixture(),{record,payment}=paidRepair(h),raw=h.sheets['Ремонты'].rows.find(x=>x.repair_id===record.id);raw['Статус']='Готов';raw['Оплачено']=700;payment['Сумма']=700;
 const result=h.correct('payment:'+payment.payment_id,{mode:'edit',amount:1000,method:'cash'});assert.equal(result.paid_after,1000);assert.equal(result.repair_completed,true);assert.equal(result.repair_id,record.id);assert.equal(result.record_status,'issued');
});
test('storage payment correction updates its actual balance and preserves original payment history',()=>{
 const h=fixture(),r=h.run('create',{kind:'storage',phone:'+79990000000',last_name:'Тест',first_name:'Клиент',brand:'Kugoo',model:'M4',storage_tariff:'month',storage_months:1,starts_on:'2026-11-01'});
 const raw=h.sheets['Зимнее хранение'].rows.find(x=>x.storage_id===r.id);raw['Статус']='На хранении';h.run('payment',{kind:'storage',id:r.id,amount:r.storage_amount,method:'transfer'});raw['Статус']='Выдан';
 const payment=h.sheets['Оплаты'].rows.find(x=>x.record_id===r.id);h.correct('payment:'+payment.payment_id);const after=h.run('get',{kind:'storage',id:r.id}).record;assert.equal(after.paid_amount,0);assert.equal(after.status,'stored');assert.equal(h.report().total,0);
});
test('a retrospective correction preserves closed shift and later till opening, recording a dated audit adjustment',()=>{
 const h=fixture(),sale=h.run('sale',{shift_id:h.shift,payment_method:'cash',items:[{part_id:h.a,quantity:1}]});h.run('shift_close',{shift_id:h.shift,counted_cash:100,note:'Закрыта'});
 const before=h.run('cash_state',{shift_id:h.shift});const next=h.run('shift_open',{register:'Касса',opening_cash:100}).id;
 h.correct('sale:'+sale.id);assert.deepEqual(h.run('cash_state',{shift_id:h.shift}).totals,before.totals);assert.equal(h.run('cash_state',{shift_id:next}).totals.expected_cash,100);assert.equal(h.report().total,0);assert.equal(h.stock(h.a),5);
});
test('invalid amounts, stale preview, missing returned goods and non-admin roles cannot mutate the snapshot',()=>{
 for(const extra of [{goods_returned:false},{expected_amount:99},{reason:''},{mode:'edit',amount:-1,method:'cash'},{mode:'edit',amount:NaN,method:'cash'},{mode:'edit',amount:10.005,method:'cash'},{mode:'edit',amount:100,method:'bogus'}]){
  const h=fixture(),sale=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]}),p={...h.command('sale:'+sale.id),...extra},before=JSON.stringify(h.sheets);assert.throws(()=>preparePaymentCorrection(h.snapshot(),p,owner));assert.equal(JSON.stringify(h.sheets),before);
 }
 const h=fixture(),sale=h.run('sale',{shift_id:h.shift,payment_method:'cash',items:[{part_id:h.a,quantity:1}]}),p=h.command('sale:'+sale.id);for(const role of ['seller','manager','receiver','mechanic','customer'])assert.throws(()=>preparePaymentCorrection(h.snapshot(),p,{...owner,role}),/доступно/);assert.throws(()=>preparePaymentCorrection(h.snapshot(),p,{...owner,role:'admin',can_sell:false}),/доступно/);
});
test('lost HTTP acknowledgement and a replay cannot duplicate reversal or stock return',async()=>{
 const h=fixture(),sale=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]}),p=h.command('sale:'+sale.id),receipts=new Map();let version=1,lose=true,commits=0;
 const db=async(path,q,method,body)=>{
  if(path==='workshop_native_receipts'){const key=new URLSearchParams(q).get('request_id').slice(3);return receipts.has(key)?[receipts.get(key)]:[];}
  if(path==='rpc/workshop_native_snapshot')return structuredClone({sheets:h.sheets,version});
  if(path!=='rpc/workshop_native_commit')throw Error(path);
  if(body.p_version!==version)return {retry:true};h.apply({changes:body.p_changes,result:body.p_result});version++;commits++;receipts.set(body.p_request_id,{actor_id:body.p_actor,action:body.p_action,fingerprint:body.p_fingerprint,result:body.p_result});if(lose){lose=false;throw Error('response lost');}return {result:body.p_result};
 };
 const context={db,actor:owner,device:{kind:'station'},stationName:'Касса',digest:async value=>createHash('sha256').update(value).digest('hex')};
 await assert.rejects(paymentCorrections('payment_correction',p,context),/response lost/);const result=await paymentCorrections('payment_correction',p,context);assert.equal(result.state,'cancelled');assert.equal(commits,1);assert.equal(h.stock(h.a),5);assert.equal(h.report().total,0);
 await assert.rejects(paymentCorrections('payment_correction',{...p,reason:'Другой запрос'},context),/уже использован/);await assert.rejects(paymentCorrections('payment_correction_preview',p,{...context,device:{kind:'terminal'}}),/кассовом ноутбуке/);
});
