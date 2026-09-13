import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache} from '../workshop/read-cache.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
test('concurrent widgets and quick revisits reuse one read; callers receive separate objects',async()=>{
 let n=0;const c=createReadCache(),d=deferred(),load=()=>{n++;return d.promise;};
 const a=c.read('owner/catalog',load),b=c.read('owner/catalog',load);d.resolve({parts:[{quantity:2}]});
 const [x,y]=await Promise.all([a,b]);x.parts[0].quantity=0;assert.equal(y.parts[0].quantity,2);assert.equal((await c.read('owner/catalog',load)).parts[0].quantity,2);assert.equal(n,1);
});
test('expiry, explicit refresh and another actor require fresh reads',async()=>{
 let clock=0,n=0;const c=createReadCache({now:()=>clock,ttl:20}),load=async()=>++n;
 assert.equal(await c.read('a',load),1);clock=21;assert.equal(await c.read('a',load),2);assert.equal(await c.read('a',load,{fresh:true}),3);assert.equal(await c.read('b',load),4);
});
test('a read started before a sale cannot refill the cache after the sale',async()=>{
 const c=createReadCache(),d=deferred();const old=c.read('stock',()=>d.promise);await Promise.resolve();const finish=c.beginWrite();finish();
 assert.equal(await c.read('stock',async()=>0),0);d.resolve(1);await old;assert.equal(await c.read('stock',async()=>99),0);
});
test('reads during writes and after session invalidation are not retained',async()=>{
 const c=createReadCache(),finish=c.beginWrite();let n=0;const load=async()=>++n;
 await c.read('stock',load);await c.read('stock',load);assert.equal(n,2);finish();await c.read('stock',load);assert.equal(n,3);c.clear();await c.read('stock',load);assert.equal(n,4);
});
test('failed requests can be retried and private URLs are never retained',async()=>{
 const c=createReadCache();await assert.rejects(c.read('x',async()=>{throw Error('offline')}));assert.equal(await c.read('x',async()=>4),4);
 let n=0;await c.read('photo',async()=>++n,{retain:false});await c.read('photo',async()=>++n,{retain:false});assert.equal(n,2);
});
test('API widgets share a catalogue; stock write invalidates it before the next display',async()=>{
 const storage=new Map([['fastgo_workshop_session',JSON.stringify({access_token:'test-session',user_id:'11111111-1111-4111-8111-111111111111',expires_at:Math.floor(Date.now()/1000)+3600})]]);
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};globalThis.window=new EventTarget();
 const realFetch=globalThis.fetch;let reads=0,quantity=2;
 globalThis.fetch=async(url,options)=>{const {action}=JSON.parse(options.body);if(action==='stock'){quantity++;return Response.json({data:{ok:true}});}if(action==='catalog'){reads++;return Response.json({data:{parts:[{quantity}]}});}throw Error(action);};
 try{const {api}=await import('../workshop/core.js?cache-integration');await Promise.all([api('catalog'),api('catalog'),api('catalog')]);assert.equal(reads,1);await api('stock',{part_id:'22222222-2222-4222-8222-222222222222',quantity:1,movement_type:'receipt',note:'test'});assert.equal((await api('catalog')).parts[0].quantity,3);assert.equal(reads,2);}finally{globalThis.fetch=realFetch;delete globalThis.window;}
});
