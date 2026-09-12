import test from 'node:test';
import assert from 'node:assert/strict';
import {operation} from '../workshop/pending.js';
function storage(){const data=new Map();return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('operation keeps same request id after reload and changed caller id',async()=>{const s=storage(),p={amount:100,id:'order',request_id:crypto.randomUUID()};const a=await operation(s,'employee','payment',p),b=await operation(s,'employee','payment',{...p,request_id:crypto.randomUUID()});assert.equal(a.params.request_id,b.params.request_id);});
test('pending operations scoped to employee and payload without customer data',async()=>{const s=storage(),a=await operation(s,'one','create',{first_name:'СекретноеИмя',phone:'+79999999999'}),b=await operation(s,'two','create',{first_name:'СекретноеИмя',phone:'+79999999999'});assert.notEqual(a.key,b.key);assert.equal(JSON.stringify([...s.data]).includes('СекретноеИмя'),false);assert.equal(JSON.stringify([...s.data]).includes('+79999999999'),false);a.finish();assert.equal(s.data.size,1);});
test('storage failure prevents a mutation being submitted',async()=>{const s=storage();s.setItem=()=>{throw Error('quota')};await assert.rejects(()=>operation(s,'user','sale',{items:[]}),/quota/);});
