import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustedTotal} from '../warehouse/price-adjustment.js';
test('discounts round in kopecks and manual prices support increases and decimal commas',()=>{
 assert.equal(adjustedTotal(1200,{mode:'discount',unit:'percent',value:'10.50'}),1074);
 assert.equal(adjustedTotal(10.01,{mode:'discount',unit:'percent',value:'50'}),5.01);
 assert.equal(adjustedTotal(100,{mode:'discount',unit:'rub',value:'12,35'}),87.65);
 assert.equal(adjustedTotal(100,{mode:'total',value:'150,25'}),150.25);
 assert.equal(adjustedTotal(100,{mode:'discount',unit:'percent',value:'100'}),0);
 for(const edit of [{mode:'discount',unit:'percent',value:'100.01'},{mode:'discount',unit:'rub',value:'101'},{value:''},{value:'-1'},{value:'0.001'},{value:'1e2'}])assert.equal(adjustedTotal(100,edit),null);
});
