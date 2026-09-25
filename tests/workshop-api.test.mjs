import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../supabase/functions/fastgo-workshop-api/index.ts',import.meta.url),'utf8').replace(/^import \{nativeClient\} from '\.\.\/_shared\/native-client\.js';\n/,'');
const user='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function setup({role='owner',active=true,valid=true,confirmed=true,record={},respond}={}){let handler;const calls=[];const fetch=async(url,options={})=>{calls.push({url,options});if(url.endsWith('/auth/v1/user')&&(options.method||'GET')!=='PUT')return Response.json(valid?{id:user,email:'qa@example.com',email_confirmed_at:confirmed?'2026-09-25T00:00:00Z':null,user_metadata:{full_name:'QA User'}}:{error:'invalid'},{status:valid?200:401});if(url.includes('/workshop_members'))return Response.json(active?[{profile_id:user,name:'QA',role,active:true,created_at:'2026-09-25T00:00:00Z',approved_at:'2026-09-25T00:00:00Z'}]:[]);if(url.includes('/service_repairs?'))return Response.json([{id,assigned_master_id:user,fault_photo_paths:[],signed_document_paths:[],...record}]);if(respond)return respond(url,options);throw new Error('Unexpected fetch: '+url);};const context={Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://db.invalid':'test-server-key'},serve:fn=>handler=fn},Request,Response,Headers,URL,URLSearchParams,AbortSignal,Uint8Array,TextDecoder,TextEncoder,atob,fetch,crypto:globalThis.crypto,nativeClient:()=>{throw new Error('native client should not be reached in this API unit test');}};vm.runInNewContext(source,context);return {calls,invoke:(body,headers={Authorization:'Bearer test-user-jwt'},method='POST')=>handler(new Request('https://edge.invalid/fastgo-workshop-api',{method,headers:{'Content-Type':'application/json',...headers},body:method==='POST'?JSON.stringify(body):undefined}))};}
test('unauthenticated caller cannot query data',async()=>{const s=setup();assert.equal((await s.invoke({action:'list'},{})).status,401);assert.equal(s.calls.length,0);});
test('invalid JWT cannot query records',async()=>{const s=setup({valid:false});assert.equal((await s.invoke({action:'get',params:{id}})).status,401);assert.equal(s.calls.length,1);});
test('inactive membership is enforced independently of token',async()=>{const s=setup({active:false});assert.equal((await s.invoke({action:'list'})).status,403);assert.equal(s.calls.length,2);});
test('CORS supports authenticated JSON requests',async()=>{const s=setup();const r=await s.invoke(null,{},'OPTIONS');assert.equal(r.status,204);assert.match(r.headers.get('Access-Control-Allow-Headers'),/authorization/);assert.equal(s.calls.length,0);});
test('mechanic cannot open storage',async()=>{const s=setup({role:'mechanic'});assert.equal((await s.invoke({action:'list',params:{kind:'storage'}})).status,403);});
test('mechanic cannot open another mechanics repair',async()=>{const s=setup({role:'mechanic',record:{assigned_master_id:'other'}});assert.equal((await s.invoke({action:'get',params:{kind:'repair',id}})).status,403);});
test('a record cannot sign an unrelated document',async()=>{const s=setup();const r=await s.invoke({action:'signed_url',params:{id,kind:'repair',path:'rental/other-client.pdf'}});assert.equal(r.status,403);assert.equal(s.calls.filter(c=>c.url.includes('/storage/v1/')).length,0);});
test('mutation actor comes from verified identity',async()=>{const s=setup({respond:async(url,options)=>{assert.match(url,/rpc\/workshop_mutate/);const body=JSON.parse(options.body);assert.equal(body.p_actor,user);return Response.json({id});}});const r=await s.invoke({action:'payment',params:{kind:'repair',id,p_actor:'forged-id'}});assert.equal(r.status,200);});
test('database conflicts are reported as conflicts',async()=>{const s=setup({respond:async()=>Response.json({code:'40001',message:'Card was updated'},{status:400})});const r=await s.invoke({action:'update',params:{id}});assert.equal(r.status,409,await r.text());});
test('non-admin cannot change staff',async()=>{const s=setup({role:'receiver'});const r=await s.invoke({action:'staff_create',params:{}});assert.equal(r.status,403,await r.text());});

test('self-registration always creates a pending mechanic request',async()=>{
  const s=setup({active:false,respond:async(url)=>{if(url.includes('/profiles'))return Response.json({});throw new Error('Unexpected fetch: '+url);}});
  const r=await s.invoke({action:'request_access',params:{role:'owner',active:true}});
  const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));
  assert.equal(body.data.active,false);assert.equal(body.data.state,'pending');
  const create=s.calls.find(c=>c.url.includes('/workshop_members')&&c.options.method==='POST');
  assert.ok(create,'membership insert was not attempted');
  const member=JSON.parse(create.options.body);assert.equal(member.role,'mechanic');assert.equal(member.active,false);
});
test('unconfirmed email cannot create an access request',async()=>{
  const s=setup({active:false,confirmed:false});
  const r=await s.invoke({action:'request_access'});
  assert.equal(r.status,403,await r.text());
  assert.equal(s.calls.filter(c=>c.url.includes('/workshop_members')&&c.options.method==='POST').length,0);
});
test('admin cannot promote a member to owner',async()=>{
  const s=setup({role:'admin'});
  const r=await s.invoke({action:'member_update',params:{profile_id:id,name:'QA',role:'owner',active:true,tags:[]}});
  assert.equal(r.status,403,await r.text());
  assert.equal(s.calls.filter(c=>c.url.includes('/rpc/workshop_mutate')).length,0);
});

test('owner device enrollment is limited to iPhone',async()=>{
  const token='33333333-3333-4333-8333-333333333333';
  const s=setup({role:'owner',respond:async(url)=>{
    if(url.includes('/workshop_owner_devices'))return Response.json([]);
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'owner_device_enroll',params:{device_token:token}});
  assert.equal(r.status,403,await r.text());
});
test('owner can bind the first iPhone as trusted device',async()=>{
  const token='33333333-3333-4333-8333-333333333333';
  const s=setup({role:'owner',respond:async(url,options)=>{
    if(url.includes('/workshop_owner_devices')&&(options.method||'GET')==='GET')return Response.json([]);
    if(url.endsWith('/rest/v1/workshop_owner_devices')&&options.method==='POST'){
      const body=JSON.parse(options.body);assert.equal(body.device_token,token);assert.equal(body.label,'iPhone 13');return Response.json({});
    }
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'owner_device_enroll',params:{device_token:token}},{Authorization:'Bearer test-user-jwt','User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
  const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));
  assert.equal(body.data.trusted,true);
});
test('owner password recovery requires the bound iPhone token',async()=>{
  const token='33333333-3333-4333-8333-333333333333';
  let recover=0;
  const s=setup({role:'owner',respond:async(url)=>{
    if(url.includes('/workshop_owner_devices'))return Response.json([]);
    if(url.includes('/auth/v1/recover')){recover++;return Response.json({});}
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'account_recovery',params:{device_token:token}});
  assert.equal(r.status,403,await r.text());assert.equal(recover,0);
});
test('trusted owner iPhone may request password recovery',async()=>{
  const token='33333333-3333-4333-8333-333333333333';
  let recover=0;
  const s=setup({role:'owner',respond:async(url)=>{
    if(url.includes('/workshop_owner_devices'))return Response.json([{device_token:token}]);
    if(url.includes('/auth/v1/recover')){recover++;return Response.json({});}
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'account_recovery',params:{device_token:token}});
  assert.equal(r.status,200,await r.text());assert.equal(recover,1);
});
test('approved employee can request password recovery',async()=>{
  let recover=0;
  const s=setup({role:'mechanic',respond:async(url)=>{
    if(url.includes('/auth/v1/recover')){recover++;return Response.json({});}
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'account_recovery'});
  assert.equal(r.status,200,await r.text());assert.equal(recover,1);
});
test('owner login cannot be changed from the employee account form',async()=>{
  const s=setup({role:'owner'});
  const r=await s.invoke({action:'account_email_change',params:{email:'new@example.com'}});
  assert.equal(r.status,403,await r.text());
});
test('approved employee can request login change',async()=>{
  let updated=false;
  const s=setup({role:'mechanic',respond:async(url,options)=>{
    if(url.endsWith('/auth/v1/user')&&options.method==='PUT'){
      updated=true;assert.equal(JSON.parse(options.body).email,'new@example.com');return Response.json({id:user,email:'new@example.com'});
    }
    throw new Error('Unexpected fetch: '+url);
  }});
  const r=await s.invoke({action:'account_email_change',params:{email:'new@example.com'}});
  assert.equal(r.status,200,await r.text());assert.equal(updated,true);
});
