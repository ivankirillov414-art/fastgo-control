import test from 'node:test';
import assert from 'node:assert/strict';
import {labelRows,labelJobs,labelDocument} from '../workshop/label-layout.mjs';
const a={id:'a',name:'Амортизатор',barcode:'FGP-00000001',quantity:2};
const b={id:'b',name:'Покрышка',barcode:'FGP-00000002',quantity:3};
test('catalog printing requires selection and ignores warehouse balance',()=>{
  const rows=labelRows([a,b]);assert.throws(()=>labelJobs(rows),/Выберите/);
  rows[0].selected=true;assert.deepEqual(labelJobs(rows).map(x=>[x.part.id,x.quantity]),[['a',1]]);
});
test('receipt preselects received quantities and combines repeated products',()=>{
  const rows=labelRows([a,b,{...a,quantity:4}],true);
  assert.deepEqual(labelJobs(rows).map(x=>[x.part.id,x.quantity]),[['a',6],['b',3]]);
  rows[1].selected=false;rows[0].quantity=2;assert.equal(labelJobs(rows).length,1);assert.equal(labelJobs(rows)[0].quantity,2);
});
test('invalid quantities and excessive print batches are rejected',()=>{
  for(const quantity of [0,-1,1.5,NaN,10001])assert.throws(()=>labelJobs([{selected:true,quantity}]),/Количество/);
  assert.throws(()=>labelJobs([{selected:true,quantity:6000},{selected:true,quantity:5000}]),/За один/);
});
test('A4 groups labels into sheets of 24 and roll format keeps individual pages',()=>{
  const labels=Array.from({length:81},(_,i)=>`<div class="label">${i}</div>`);
  const a4=labelDocument(labels);assert.equal((a4.match(/<section class="sheet">/g)||[]).length,4);assert.equal((a4.match(/<div class="label">/g)||[]).length,81);assert.match(a4,/@page\{size:A4/);
  const roll=labelDocument(labels,'roll');assert.doesNotMatch(roll,/<section/);assert.match(roll,/@page\{size:58mm 30mm/);assert.match(roll,/\.label:last-child\{break-after:auto\}/);
});
