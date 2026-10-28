import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../supabase/functions/fastgo-workshop-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function setup(role='mechanic',permissions={},recordOverrides={}){
 let handler;const writes=[];
 const record={id,revision:1,status:'accepted',assigned_master_id:'',works:[],parts:[],total_amount:0,paid_amount:0,...recordOverrides};
 const fetch=async url=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user,email:'master@example.invalid'});
  if(url.includes('/workshop_members'))return Response.json([{profile_id:user,role,active:true,...permissions}]);
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

test('individual sales and catalogue rights are enforced without granting administrator access',async()=>{
 const granted=setup('mechanic',{can_sell:true,can_edit_catalog:true});
 assert.equal((await granted.invoke('cash_state')).status,200);
 assert.equal((await granted.invoke('catalog_save',{id,title:'Работа',category:'Механика',labor_price:500})).status,200);
 for(const action of ['part_save','staff_create','stock_receive','legal_save'])assert.equal((await granted.invoke(action)).status,403,action);
 const denied=setup();assert.equal((await denied.invoke('cash_state')).status,403);assert.equal((await denied.invoke('catalog_save',{id,title:'Работа',labor_price:500})).status,403);
 const forged=setup();assert.equal((await forged.invoke('cash_state',{can_sell:true})).status,403);
});


test('step actions derive API status and preserve quality confirmation without manual approval',async()=>{
 const works=[{catalog_id:'service',name:'Настройка тормозов',quantity:1,price:1000}];
 for(const [action,status,target,extra] of [['save_works','diagnostics','repair',{}],['wait_parts','repair','waiting_parts',{waiting_part:'Трос',waiting_due:'2026-11-10'}],['complete','repair','ready',{quality_checked:true,no_parts:true}]]){
  const s=setup('mechanic',{}, {status,assigned_master_id:user,diagnostics_notes:'',works,total_amount:1000,approved_amount:null,parts_status:{mode:'none'},quality_checked:false});
  const response=await s.invoke('update',{kind:'repair',id,revision:1,step_flow:true,flow_action:action,works,...extra});assert.equal(response.status,200,await response.clone().text());const saved=s.writes.find(x=>x.action==='update');assert.equal(saved.p.status,target);if(action==='complete')assert.equal(saved.p.quality_checked,true);
 }
});
