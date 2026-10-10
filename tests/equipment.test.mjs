import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {equipmentType,filterEquipment}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('../workshop/equipment-core.js',import.meta.url),'utf8')).toString('base64'));
test('equipment uses shared stock categories and excludes repair parts',()=>{
 const rows=[{name:'Самокат A',category:'Техника · Электросамокаты',quantity:2,barcode:'FGP-001'},{name:'Велосипед',category:'Электровелосипеды',quantity:0},{name:'Тормоза самоката',category:'Тормоза',quantity:4},{name:'Архив',category:'Техника · Велосипеды',active:false,quantity:1}];
 assert.equal(equipmentType(rows[0]),'Электросамокаты');
 assert.equal(filterEquipment(rows).length,2);
 assert.equal(filterEquipment(rows,{available:true}).length,1);
 assert.equal(filterEquipment(rows,{search:'FGP-001'})[0],rows[0]);
 assert.equal(filterEquipment(rows,{type:'Электровелосипеды'})[0],rows[1]);
});
