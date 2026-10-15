import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaChange,mediaReadMatches} from '../workshop/media-change.js';
import {createReadCache} from '../workshop/read-cache.js';
test('photo writes invalidate only their media reads, ordinary mutations remain global',()=>{
 const key=(action,params={})=>JSON.stringify({actor:'a',action,params});
 const part=mediaChange('part_photo_upload',{part_id:'one'});
 assert.equal(mediaReadMatches(key('catalog'),part),true);
 assert.equal(mediaReadMatches(key('part_photo_url',{part_id:'two'}),part),false);
 assert.equal(mediaChange('sale',{id:'one'}),null);
});
test('targeted invalidation rejects stale in-flight media without throwing away unrelated reads',async()=>{
 const c=createReadCache();let finish;
 await c.read('other',async()=>7);
 const old=c.read('photo',()=>new Promise(resolve=>finish=resolve));await Promise.resolve();
 c.invalidate(key=>key==='photo');await c.read('photo',async()=>2);
 finish(1);await old;
 assert.equal(await c.read('photo',async()=>99),2);
 assert.equal(await c.read('other',async()=>99),7);
});
test('actual photo API retains unrelated list caches and announces only the affected card',async()=>{
 const saved=new Map([['fastgo_workshop_session',JSON.stringify({access_token:'fixture',user_id:'fixture',expires_at:4102444800})]]);
 globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 globalThis.window=new EventTarget();const events=[];window.addEventListener('workshop-data-changed',e=>events.push(e.detail));
 const real=globalThis.fetch;let lists=0;
 globalThis.fetch=async(url,options)=>{const {action}=JSON.parse(options.body);if(action==='list'){lists++;return Response.json({data:{items:[]}});}return Response.json({data:{path:'native:test'}});};
 try{const {api}=await import('../workshop/core.js?media-test');await api('list',{kind:'repair'});await api('part_photo_upload',{part_id:'one',content_base64:'dGVzdA=='});await api('list',{kind:'repair'});assert.equal(lists,1);assert.equal(events.length,1);assert.deepEqual(events[0],{scope:'media',part_id:'one',local:true});}
 finally{globalThis.fetch=real;delete globalThis.window;}
});
