import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {authenticatedUser} from '../supabase/arise-functions/_shared/identity.mjs';
import {createHandler} from '../supabase/arise-functions/_shared/server.mjs';
import {PHYSICAL,PHYSICAL_BRANCHES,QUESTS,TRACKS} from '../arise/curriculum.mjs';
import {PoseCounter,angle,posePhase} from '../arise/pose.mjs';
import {request} from '../arise/core.mjs';
const env={get:name=>({SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-test-only'})[name]};
const user={id:'a1111111-1111-4111-8111-111111111111',email:'test@example.com',email_confirmed_at:'2026-09-10T00:00:00Z'};
test('old browser key alone never grants API access',async()=>{
 const handler=createHandler('rpg-progress',{env,fetcher:()=>{throw Error('must not fetch');}});
 assert.equal((await handler(new Request('https://example/rpg-progress',{headers:{'x-device-id':'old-browser-key-00000000'}}))).status,401);
});
test('user token is checked with Auth, not just decoded',async()=>{
 await assert.rejects(authenticatedUser(new Request('https://example',{headers:{Authorization:'Bearer forged'}}),env,async()=>new Response('',{status:401})),/auth_required/);
});
test('unconfirmed and anonymous identities are rejected',async()=>{
 for(const value of [{...user,email_confirmed_at:null},{...user,is_anonymous:true}]){
  await assert.rejects(authenticatedUser(new Request('https://example',{headers:{Authorization:'Bearer fixture'}}),env,async()=>Response.json(value)),/email_verification_required/);
 }
});
test('client device and metadata cannot select another account',async()=>{
 const paths=[];
 const handler=createHandler('rpg-progress',{env,fetcher:async(input,opt)=>{
  const url=new URL(input);paths.push(url.pathname);
  if(url.pathname==='/auth/v1/user')return Response.json({...user,user_metadata:{device_id:'victim-key'}});
  if(url.pathname.endsWith('/arise_account_device')){assert.deepEqual(JSON.parse(opt.body),{p_user_id:user.id});return Response.json('server-owned-random-key');}
  if(url.pathname.endsWith('/arise_training_days'))return Response.json([]);
  assert.deepEqual(JSON.parse(opt.body),{p_device_id:'server-owned-random-key'});
  return Response.json({xp:0,completed_quests:[]});
 }});
 const response=await handler(new Request('https://example/rpg-progress',{headers:{Authorization:'Bearer fixture','x-device-id':'victim-key'}}));
 assert.equal(response.status,200);assert.equal(paths.length,4);
});
test('migration request stores pending claim without reading or transferring legacy progress',async()=>{
 const handler=createHandler('migration',{env,fetcher:async(input,opt)=>{
  const url=new URL(input);
  if(url.pathname==='/auth/v1/user')return Response.json(user);
  if(url.pathname.endsWith('/arise_account_device'))return Response.json('server-owned-random-key');
  assert.equal(url.pathname,'/rest/v1/arise_migration_requests');
  assert.equal(JSON.parse(opt.body).user_id,user.id);assert.equal(Object.hasOwn(JSON.parse(opt.body),'status'),false);
  return new Response(null,{status:201});
 }});
 const response=await handler(new Request('https://example/migration',{method:'POST',headers:{Authorization:'Bearer fixture','content-type':'application/json'},body:JSON.stringify({legacy_device_id:'legacy-random-key-00001',status:'approved',user_id:'victim'})}));
 assert.equal(response.status,200);assert.equal((await response.json()).status,'pending');
});
test('new account requests do not send a legacy device header',async()=>{
 await request('https://example/','progress',{headers:{Authorization:'Bearer fixture'},fetcher:async(url,opt)=>{assert.equal(Object.hasOwn(opt.headers,'x-device-id'),false);return Response.json({});}});
});
test('four recovered branches provide 24 distinct E–S gates without changing old ids',()=>{
 assert.equal(Object.keys(TRACKS).length,6);assert.equal(PHYSICAL.length,24);assert.equal(QUESTS.length,76);
 for(const b of PHYSICAL_BRANCHES){const q=PHYSICAL.filter(x=>x.track===b.id);assert.deepEqual(q.map(x=>x.rank),['E','D','C','B','A','S']);assert.deepEqual(q.map(x=>x.goal),b.goals);}
});
test('repetition counter needs a stable complete cycle, not a static posture',()=>{
 const c=new PoseCounter('reps');for(let t=100;t<=900;t+=100)c.update('down',t);assert.equal(c.reps,0);
 for(let t=1000;t<=1300;t+=100)c.update('up',t);
 for(let t=1400;t<=1900;t+=100)c.update('down',t);
 for(let t=2000;t<=2400;t+=100)c.update('up',t);
 assert.equal(c.reps,1);for(let t=2500;t<=3000;t+=100)c.update('up',t);assert.equal(c.reps,1);
});
test('lost pose resets unfinished repetitions; hold time pauses and caps long frame gaps',()=>{
 const reps=new PoseCounter('reps');for(let t=100;t<500;t+=100)reps.update('up',t);for(let t=500;t<900;t+=100)reps.update('down',t);reps.update('missing',1000);for(let t=1100;t<1500;t+=100)reps.update('up',t);assert.equal(reps.reps,0);
 const hold=new PoseCounter('hold');hold.update('hold',100);hold.update('hold',200);hold.update('missing',300);hold.update('hold',10000);assert.equal(hold.validMs,100);hold.update('hold',20000);assert.equal(hold.validMs,350);
});
test('invalid landmarks do not count; simple joint angles are correct',()=>{
 assert.equal(posePhase('strength',[]),'missing');assert.equal(angle({x:0,y:0},{x:0,y:1},{x:1,y:1}),90);
});
test('physical module has no frame/video upload and backup omits tokens',async()=>{
 const pose=await readFile(new URL('../arise/pose.mjs',import.meta.url),'utf8');
 assert.equal(/MediaRecorder|toDataURL|toBlob|FormData|fetch\(/.test(pose),false);
 const app=await readFile(new URL('../arise/app.mjs',import.meta.url),'utf8');
 assert.ok(app.includes("version:2,studied,exportedAt"));assert.equal(app.includes('version:2,device'),false);
});
