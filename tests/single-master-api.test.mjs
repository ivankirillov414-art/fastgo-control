import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../supabase/functions/fastgo-workshop-api/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'');
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function setup(role='mechanic'){
 let handler;const writes=[];
 const record={id,revision:1,status:'accepted',assigned_master_id:'',works:[],parts:[],total_amount:0,paid_amount:0};
 const fetch=async url=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email:'master@example.invalid'});
  if(url.includes('/workshop_members'))return Response.json([{profile_id:user,role,active:true}]);
  if(url.includes('/workshop_backend_config'))return Response.json([{sheets_api_url:'https://script.google.com/macros/s/test/exec',sheets_api_secret:'test',storage_mode:'postgres'}]);
  throw Error('Unexpected request '+url);
 };
 const nativeClient=({actor})=>async(action,p)=>{
  assert.equal(actor.id,user);
  if(action==='health')return {capabilities:{atomic_writes:true}};
  if(action==='operation_retry')return {status:'not_found'};
  if(action==='get')return {record:{...record}};
  writes.push({action,p});return {id,...p};
 };
 vm.runInNewContext(source,{Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://db.invalid':'test'},serve:fn=>handler=fn},fetch,nativeClient,Request,Response,Headers,URL,URLSearchParams,AbortSignal,Uint8Array,TextDecoder,TextEncoder,atob,crypto:globalThis.crypto});
 return {writes,invoke:async(action,params={})=>handler(new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({action,params:{request_id:crypto.randomUUID(),...params}})}))};
}
test('master can save an unassigned repair in diagnostics through the authenticated API',async()=>{
 const s=setup(),r=await s.invoke('update',{kind:'repair',id,revision:1,status:'diagnostics',works:[],parts:[]});
 assert.equal(r.status,200,await r.text());assert.ok(s.writes.some(x=>x.action==='update'));
});
test('master and former receiver have the same repair status permissions',async()=>{
 for(const role of ['mechanic','receiver','manager']){const s=setup(role),r=await s.invoke('me');assert.equal(r.status,200);const d=(await r.json()).data.status_permissions;assert.equal(d.can_mark_ready,true);assert.equal(d.can_issue,true);assert.equal(d.can_cancel,true);}
});
test('master can create intake but cannot manage employee accounts',async()=>{
 const s=setup(),r=await s.invoke('create',{kind:'repair',phone:'+79991234567',last_name:'Тест',first_name:'Мастер',brand:'Тест',model:'Тест'});assert.equal(r.status,200,await r.text());
 assert.equal((await s.invoke('staff_create')).status,403);
});
