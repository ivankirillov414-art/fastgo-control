import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../warehouse/'+name,import.meta.url),'utf8')).toString('base64'));
const {equipmentData:d}=await load('equipment-data.js');
const {linkedEquipment,purchaseOperation,purchaseValue,selectEquipment}=await load('equipment-reference-core.js');
test('reference catalogue has independently sourced dated RUB prices and unique stable IDs',()=>{
 assert.equal(d.currency,'RUB');assert.ok(d.items.length>2000);assert.equal(new Set(d.items.map(x=>x.id)).size,d.items.length);
 for(const x of d.items){assert.ok(x.name&&x.brand&&x.category);assert.match(x.id,/^eq-[a-f0-9]{20}$/);assert.ok(x.offers.length);assert.equal(x.price_min,Math.min(...x.offers.map(o=>o.price)));for(const o of x.offers){assert.ok(o.price>=500&&Number.isFinite(o.price));assert.ok(o.high>=o.price);assert.match(o.url,/^https:\/\//);assert.match(o.checked_at,/^\d{4}-\d{2}-\d{2}$/);}}
});
test('purchase creation never invents stock or converts market price into actual sale price',()=>{const x=d.items[0],op=purchaseOperation(x,null,12.25,'request');assert.equal(op.action,'part_save');assert.equal(op.params.unit_cost,12.25);assert.equal(op.params.retail_price,0);assert.equal(op.params.quantity,undefined);assert.equal(op.params.sku,'REF-'+x.id);});
test('existing cost uses optimistic and idempotent field-specific update',()=>{const x=d.items[0],p={id:'part',unit_cost:100};const op=purchaseOperation(x,p,120,'same');assert.deepEqual(op,{action:'inventory_edit',params:{request_id:'same',part_id:'part',field:'unit_cost',value:120,expected:100}});});
test('linking refuses ambiguous names and accepts exact stable reference SKU',()=>{const x=d.items[0],p={name:x.name,category:'Техника · '+x.category,active:true};assert.equal(linkedEquipment(x,[p]),p);assert.equal(linkedEquipment(x,[p,{...p}]),null);const ref={sku:'REF-'+x.id};assert.equal(linkedEquipment(x,[p,{...p},ref]),ref);});
test('cost accepts zero and comma cents but rejects empty negative precision and nonfinite values',()=>{assert.equal(purchaseValue('0'),0);assert.equal(purchaseValue('125,25'),125.25);for(const v of ['', '-1','1.001','Infinity','1e4','100000001'])assert.throws(()=>purchaseValue(v));});
test('search and category filters compose without hiding Cyrillic names',()=>{const x=d.items.find(x=>x.brand==='Kugoo');assert.ok(x);assert.ok(selectEquipment(d.items,{search:x.model,category:x.category,brand:x.brand}).some(y=>y.id===x.id));});
