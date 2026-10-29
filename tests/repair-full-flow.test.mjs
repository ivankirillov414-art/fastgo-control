import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {repairApiFixture,ownerId,masterId,serviceId} from './helpers/repair-api-fixture.mjs';

for(const actor of [ownerId,masterId])for(const withParts of [false,true])for(const method of ['cash','card','transfer'])test(`real API: ${actor===ownerId?'owner':'mechanic'} → ${withParts?'parts':'no parts'} → ${method} → issue`,async()=>{
 const h=repairApiFixture();let r=await h.create();
 const step=async(action,extra={})=>r=await h.call('update',{kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),step_flow:true,flow_action:action,...extra},actor);
 await step('diagnose');assert.equal(r.status,'diagnostics');
 await step('save_works',{works:[{catalog_id:serviceId,name:'Настройка тормозов',price:1500.5,quantity:1}]});
 if(actor===ownerId)await step('save_comment',{assigned_master_id:masterId});
 if(withParts){
  await step('wait_parts',{waiting_part:'Тормозной трос',waiting_due:'2026-11-10'});
  const ticket=await h.call('parts_pickup',{kind:'repair',id:r.id},actor),id=randomUUID();await h.issue(ticket.code,id);await h.issue(ticket.code,id);
  r=(await h.call('get',{kind:'repair',id:r.id},actor)).record;assert.equal(r.status,'repair');assert.equal(r.parts.length,1);
 }
 await step('complete',{quality_checked:true,no_parts:!withParts,master_comment:'Проверено на стенде'});assert.equal(r.status,'ready');
 const payment={kind:'repair',id:r.id,request_id:randomUUID(),amount:r.total_amount,method};await h.call('payment',payment,ownerId);await h.call('payment',payment,ownerId);
 r=(await h.call('get',{kind:'repair',id:r.id},ownerId)).record;
 r=await h.call('update',{kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),step_flow:true,flow_action:'handover',works:r.works,master_comment:r.step_state.master_comment},ownerId);
 assert.equal(r.status,'issued');assert.equal(r.assigned_master_id,masterId);assert.equal(r.total_amount,withParts?2250.5:1500.5);assert.equal(r.paid_amount,r.total_amount);
 assert.equal(h.sheets['Оплаты'].rows.length,1);assert.equal(h.sheets['Движения склада'].rows.length,withParts?1:0);assert.equal(h.sheets['Товары'].rows[0]['Остаток, шт.'],withParts?4:5);
});

test('parts QR takes an advanced step repair for a mechanic without legacy diagnosis or approval fields',async()=>{
 const h=repairApiFixture();let r=await h.create();for(const [action,extra] of [['diagnose',{}],['save_works',{works:[{catalog_id:serviceId,name:'Настройка тормозов',price:1000,quantity:1}]}]])r=await h.call('update',{kind:'repair',id:r.id,revision:r.revision,request_id:randomUUID(),step_flow:true,flow_action:action,...extra});
 const ticket=await h.call('parts_pickup',{kind:'repair',id:r.id},masterId);assert.match(ticket.code,/^FGPARTS1\./);
 r=(await h.call('get',{kind:'repair',id:r.id})).record;assert.equal(r.assigned_master_id,masterId);assert.equal(r.status,'repair');assert.equal(r.total_amount,1000);
});

test('opening parts on a closed unassigned repair cannot create an assignment',async()=>{
 const h=repairApiFixture(),r=await h.create();h.sheets['Ремонты'].rows[0]['Статус']='Готов';const before=h.writes.length;
 await assert.rejects(h.call('parts_pickup',{kind:'repair',id:r.id},masterId),e=>e.status===409);assert.equal(h.writes.length,before);
});
