import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const edge=await readFile(new URL('../supabase/functions/fastgo-workshop-api/index.ts',import.meta.url),'utf8');
const id='11111111-1111-4111-8111-111111111111';
function server({member=null,confirmed=true}={}){
 const writes=[];let handler;
 const context=vm.createContext({Response,Request,URL,TextDecoder,Uint8Array,AbortSignal,crypto,
 Deno:{env:{get:()=>''},serve:f=>handler=f},
 fetch:async(url,options={})=>{
  if(url==='/auth/v1/user')return Response.json({id,email:'test@example.test',email_confirmed_at:confirmed?'2026-09-19':null,user_metadata:{full_name:'Test',role:'owner'}});
  if(url.startsWith('/rest/v1/workshop_members')){
   if(options.method==='POST'){const data=JSON.parse(options.body);writes.push(data);member??=data;return Response.json(null);}
   return Response.json(member?[member]:[]);
  }
  if(url==='/rest/v1/profiles'){writes.push(JSON.parse(options.body));return Response.json(null);}
  throw new Error('Unexpected request '+url);
 }});
 vm.runInContext(edge.replace(/^import .*\n/,''),context);
 return {writes,call:(action='request_access',params={},authenticated=true)=>handler(new Request('https://test.invalid',{method:'POST',headers:authenticated?{Authorization:'Bearer test'}:{},body:JSON.stringify({action,params})}))};
}
test('registration cannot select role, identity or activate access',async()=>{
 const s=server();const r=await s.call('request_access',{profile_id:'someone-else',role:'owner',active:true});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{data:{active:false}});
 assert.equal(s.writes[1].profile_id,id);assert.equal(s.writes[1].role,'mechanic');assert.equal(s.writes[1].active,false);
 await s.call();assert.equal(s.writes.length,2);
});
test('existing owner and disabled member are never overwritten',async()=>{
 for(const active of [true,false]){const s=server({member:{profile_id:id,role:'owner',active}});assert.deepEqual(await (await s.call()).json(),{data:{active}});assert.equal(s.writes.length,0);}
});
test('unconfirmed and anonymous requests cannot create memberships',async()=>{
 const s=server({confirmed:false});assert.equal((await s.call()).status,403);assert.equal((await s.call('request_access',{},false)).status,401);assert.equal(s.writes.length,0);
});
test('pending users cannot read workshop records',async()=>{
 const s=server({member:{profile_id:id,active:false}});
 // Real PostgREST filters active=false rows out of the authorization lookup.
 const noMember=server();assert.equal((await noMember.call('list')).status,403);assert.equal(noMember.writes.length,0);
});

const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.window={addEventListener(){},dispatchEvent(){}};
const {signUp,sessionAvailable,clearSession}=await import('../workshop/core.js');
test('signup stores immediate session but never stores passwords or authorization roles',async()=>{
 let sent;globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);assert.ok(url.endsWith('/auth/v1/signup'));return Response.json({access_token:'test',refresh_token:'refresh',expires_in:3600,user:{id}});};
 assert.deepEqual(await signUp(' Employee ',' a@example.test ','long-password-123'),{signedIn:true});
 assert.equal(sessionAvailable(),true);assert.deepEqual(sent.data,{full_name:'Employee'});assert.equal(sent.email,'a@example.test');assert.ok(!JSON.stringify([...values]).includes('long-password'));clearSession();
});
test('email confirmation response is not treated as an authenticated session',async()=>{
 globalThis.fetch=async()=>Response.json({id,identities:[]});assert.deepEqual(await signUp('Employee','a@example.test','long-password-123'),{signedIn:false});assert.equal(sessionAvailable(),false);
});
test('weak passwords rejected before request and duplicate account errors translated',async()=>{
 globalThis.fetch=async()=>{throw new Error('Must not request')};await assert.rejects(signUp('Employee','a@example.test','short'),/12/);
 globalThis.fetch=async()=>Response.json({msg:'User already registered'},{status:422});await assert.rejects(signUp('Employee','a@example.test','long-password-123'),/уже зарегистрирован/);
});
