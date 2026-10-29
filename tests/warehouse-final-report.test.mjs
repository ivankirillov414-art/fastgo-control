import test from 'node:test';import assert from 'node:assert/strict';import {finalReport} from '../supabase/functions/fastgo-warehouse/final-report.js';
const sheet=rows=>({rows}),pay=(id,method,amount,kind='repair',record_id=id)=>({payment_id:id,'Дата':'2026-10-28T09:00:00Z','Способ оплаты':method,'Сумма':amount,'Тип':kind,record_id}),sale=(id,method,total)=>({sale_id:id,'Дата':'2026-10-28T09:00:00Z','Способ оплаты':method,'Итого':total,'Номер':'FGS-1'});
test('final report counts repairs, storage, sales and manual work once with exact cents',()=>{const sheets={'Оплаты':sheet([pay('a','cash',.1),pay('b','transfer',200,'storage'),pay('c','card',300,'service','service-sale')]),'Продажи':sheet([sale('service-sale','Карта',300),sale('stock-sale','Наличные',.2)]),'Ремонты':sheet([{repair_id:'a','Номер ремонта':26}]),'Зимнее хранение':sheet([{storage_id:'b','Номер':7}])};const before=JSON.stringify(sheets),r=finalReport(sheets);assert.equal(r.total,500.3);assert.equal(r.count,4);assert.equal(r.groups[0].total,.3);assert.equal(r.groups[1].items[0].title,'Хранение № 7');assert.equal(JSON.stringify(sheets),before);});
test('final report period bounds, pagination and totals remain independent',()=>{const sheets={'Оплаты':sheet(Array.from({length:105},(_,i)=>pay(String(i),'cash',1)))};const r=finalReport(sheets,{method:'cash',offset:100,from:'2026-10-28T00:00:00Z',to:'2026-10-29T00:00:00Z'});assert.equal(r.total,105);assert.equal(r.groups[0].count,105);assert.equal(r.groups[0].items.length,5);assert.equal(finalReport(sheets,{from:'2026-10-29T00:00:00Z'}).count,0);assert.equal(finalReport(sheets,{to:'2026-10-28T09:00:00Z'}).count,0);});
test('final report refuses malformed dates and unknown payment methods rather than omitting money',()=>{assert.throws(()=>finalReport({},{from:'wrong'}),/даты/);assert.throws(()=>finalReport({},{offset:-1}),/страница/);assert.throws(()=>finalReport({'Оплаты':sheet([pay('a','unknown',5)])}),/неизвестным/);});

test('adjacent local cash days include midnight once and retain all historical operations',()=>{
 const at=(id,date,amount)=>({...pay(id,'cash',amount),'Дата':date});
 const sheets={'Оплаты':sheet([
  at('before','2026-10-27T18:59:59.999Z',1000),
  at('start','2026-10-27T19:00:00.000Z',100.1),
  at('end','2026-10-28T18:59:59.999Z',20.2),
  at('next','2026-10-28T19:00:00.000Z',300)
 ])},before=JSON.stringify(sheets);
 const day=finalReport(sheets,{from:'2026-10-28T00:00:00+05:00',to:'2026-10-29T00:00:00+05:00'});
 const next=finalReport(sheets,{from:'2026-10-29T00:00:00+05:00',to:'2026-10-30T00:00:00+05:00'});
 assert.equal(day.total,120.3);assert.deepEqual(day.groups[0].items.map(x=>x.id),['payment:end','payment:start']);
 assert.equal(next.total,300);assert.equal(next.count,1);
 assert.equal(finalReport(sheets,{from:'2026-10-30T00:00:00+05:00',to:'2026-10-31T00:00:00+05:00'}).count,0);
 assert.equal(finalReport(sheets).total,1420.3);assert.equal(JSON.stringify(sheets),before);
});
