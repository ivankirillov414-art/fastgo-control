import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {createNativeEngine} from '../supabase/functions/_shared/native-engine.js';import {prepareRepairPayment} from '../supabase/functions/fastgo-warehouse/repair.js';
const owner={id:randomUUID(),role:'owner',name:'Петров Алексей Иванович'};
function fixture(paid=false){
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),engine=createNativeEngine(Object.fromEntries(Object.entries(schema).map(([key,headers])=>[key,{headers,rows:[]}])));
 const service=randomUUID();engine.sheets['Прайс работ'].rows.push({__row:2,service_id:service,'Работа':'Настройка','Работа, ₽':1600,'Активна':true});
 let record=engine.run('create',{kind:'repair',phone:'+79990000000',last_name:'Тест',first_name:'Клиент',brand:'Kugoo',model:'M4',request_id:randomUUID()},owner);
 for(const params of [{flow_action:'diagnose',works:[]},{flow_action:'save_works',works:[{catalog_id:service,name:'Настройка',quantity:1,price:1600}]},{flow_action:'complete',quality_checked:true,no_parts:true,payment_qr:true}])record=engine.run('update',{kind:'repair',id:record.id,revision:record.revision,request_id:randomUUID(),step_flow:true,...params},owner);
 if(paid){const payment=prepareRepairPayment({sheets:engine.sheets},{request_id:randomUUID(),repair_id:record.id,expected_revision:record.revision,amount:1600,method:'cash'},owner);for(const change of payment.changes){let row=engine.sheets[change.sheet].rows.find(x=>x.__row===change.row);if(row)Object.assign(row,change.values);else engine.sheets[change.sheet].rows.push({__row:change.row,...change.values});}record=engine.run('get',{kind:'repair',id:record.id},owner).record;}
 const params=()=>({kind:'repair',id:record.id,revision:record.revision,request_id:randomUUID(),works:record.works,parts:(record.parts||[]).map((x,i)=>({...x,source_index:i})),total_amount:record.total_amount,document:{title:'АКТ ВЫПОЛНЕННЫХ РАБОТ',note:'Уточнённое описание'},reason:'Уточнение состава работ'});
 return {engine,record,params};
}
test('act edits persist printable text and actual repair lines, totals and actor audit together',()=>{
 const {engine,record,params}=fixture(),p=params();p.works=[{name:'Точная настройка',quantity:2,price:900}];p.parts=[{name:'Расходные материалы вне склада',quantity:1,price:200}];p.total_amount=2000;p.document.master_name='Алексей';
 const result=engine.run('repair_act_save',p,owner);assert.equal(result.total_amount,2000);assert.equal(result.works[0].name,'Точная настройка');assert.equal(result.parts[0].price,200);assert.equal(result.revision,record.revision+1);assert.equal(result.completion_act.note,p.document.note);assert.equal(result.paid_amount,0);
 const events=engine.sheets['События'].rows.filter(e=>e['Действие']==='repair_act_edit');assert.equal(events.length,1);assert.equal(events[0].actor_id,owner.id);assert.equal(JSON.parse(events[0]['Детали']).previous.total,1600);
 assert.equal(engine.sheets['Оплаты'].rows.length,0);assert.equal(engine.sheets['Движения склада'].rows.length,0);
 const read=engine.run('get',{kind:'repair',id:record.id},owner).record;assert.equal(read.completion_act.master_name,'Алексей');assert.equal(read.total_override,2000);
});
test('editing a paid repair creates an exact additional-payment balance and preserves its original payment',()=>{
 const {engine,record,params}=fixture(true),p=params();p.works=[{name:'Дополненная работа',quantity:1,price:1800}];p.total_amount=1800;
 const result=engine.run('repair_act_save',p,owner);assert.equal(result.status,'ready');assert.equal(result.paid_amount,1600);assert.equal(result.total_amount,1800);assert.equal(engine.sheets['Оплаты'].rows.length,1);assert.notEqual(result.step_state.completion_request_id,record.step_state.completion_request_id);
 const payment=prepareRepairPayment({sheets:engine.sheets},{repair_id:record.id,request_id:randomUUID(),expected_revision:result.revision,amount:200,method:'card'},owner);assert.equal(payment.result.repair_completed,true);assert.equal(payment.result.amount,200);
});
test('text-only corrections retain issued state, payment and original completion print key',()=>{
 const {engine,record,params}=fixture(true),p=params();p.document.note='Исправлена опечатка <script> не выполняется';const result=engine.run('repair_act_save',p,owner);assert.equal(result.status,'issued');assert.equal(result.step_state.completion_request_id,record.step_state.completion_request_id);assert.equal(engine.sheets['Оплаты'].rows.length,1);assert.equal(result.total_amount,1600);
});
test('paid amount, inventory quantities, role access, revisions and invalid rows are protected',()=>{
 for(const alter of [p=>p.total_amount=1500,p=>p.works[0].quantity=0,p=>p.works[0].price=NaN,p=>p.works[0].name='',p=>p.reason='',p=>p.revision--,p=>p.document.date='2026-02-31']){
  const {engine,params,record}=fixture(true),p=structuredClone(params());alter(p);assert.throws(()=>engine.run('repair_act_save',p,owner));assert.equal(engine.run('get',{kind:'repair',id:record.id},owner).record.total_amount,1600);
 }
 const {engine,params}=fixture();for(const role of ['seller','customer'])assert.throws(()=>engine.run('repair_act_save',params(),{...owner,role}),/доступ/i);
 const raw=engine.sheets['Ремонты'].rows[0];raw['Строки запчастей']=JSON.stringify([{part_id:randomUUID(),name:'Выданная деталь',quantity:1,price:100}]);const record=engine.run('get',{kind:'repair',id:raw.repair_id},owner).record;
 const base={...params(),parts:record.parts.map((x,i)=>({...x,source_index:i})),total_amount:1700};assert.throws(()=>engine.run('repair_act_save',{...base,parts:[]},owner),/возврат/);assert.throws(()=>engine.run('repair_act_save',{...base,parts:[{...base.parts[0],quantity:2}]},owner),/Количество/);
 assert.equal(engine.run('repair_act_save',{...base,parts:[{...base.parts[0],name:'Уточнённая деталь',price:200}],total_amount:1800},owner).parts[0].price,200);
});
