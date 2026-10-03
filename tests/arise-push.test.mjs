import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushHandler,validPushEndpoint} from '../supabase/arise-functions/_shared/push.mjs';
const token='a'.repeat(64),values={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'server-key',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private'},env={get:k=>values[k]};
const request=body=>new Request('https://api.test',{method:'POST',headers:{'x-arise-scheduler':token},body:JSON.stringify(body||{})});
test('push endpoint accepts browser vendors and rejects SSRF and credentials',()=>{
 for(const host of ['fcm.googleapis.com','web.push.apple.com','updates.push.services.mozilla.com'])assert.equal(validPushEndpoint('https://'+host+'/send/abc'),true);
 for(const url of ['https://localhost/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','http://fcm.googleapis.com/a','https://user@fcm.googleapis.com/a','https://web.push.apple.com:8443/a'])assert.equal(validPushEndpoint(url),false);
});
test('scheduler rejects missing or invalid credentials before claiming work',async()=>{
 let calls=0;const handler=createPushHandler({env,fetcher:async()=>{calls++;return Response.json(false);}});
 assert.equal((await handler(new Request('https://api.test',{method:'POST'}))).status,401);assert.equal(calls,0);
 assert.equal((await handler(request())).status,401);assert.equal(calls,1);
});
test('scheduler dry run verifies configuration without claiming or sending',async()=>{
 const calls=[];const handler=createPushHandler({env,fetcher:async u=>{calls.push(u);return Response.json(true);}});
 assert.deepEqual(await (await handler(request({dry_run:true}))).json(),{ok:true,configured:true});assert.equal(calls.length,1);
});
test('expired subscriptions are disabled and network failures cannot count as sent',async()=>{
 const finishes=[],items=[{delivery_id:1,endpoint:'https://web.push.apple.com/a',p256dh:'k',auth:'a',slot:'morning'},{delivery_id:2,endpoint:'https://fcm.googleapis.com/b',p256dh:'k',auth:'a',slot:'evening'},{delivery_id:3,endpoint:'https://localhost/c',slot:'morning'}];
 const handler=createPushHandler({env,requestDetails:(sub,payload)=>{assert.equal(JSON.parse(payload).url,'achievements.html#quests');return {endpoint:sub.endpoint,headers:{},body:'encrypted'};},fetcher:async(u,options)=>{
  if(u.endsWith('arise_scheduler_authorized'))return Response.json(true);
  if(u.endsWith('arise_claim_push'))return Response.json(items);
  if(u.endsWith('arise_finish_push')){finishes.push(JSON.parse(options.body));return Response.json(null);}
  if(u.includes('apple'))return new Response('',{status:410});
  if(u.includes('googleapis'))throw Error('timeout');
  throw Error('unsafe request');
 }});
 assert.deepEqual(await (await handler(request())).json(),{ok:true,sent:0,failed:1,expired:2});assert.deepEqual(finishes.map(x=>x.p_status),['expired','failed','expired']);
});
test('missing private VAPID key prevents claiming jobs',async()=>{
 const calls=[];const handler=createPushHandler({env:{get:k=>k==='VAPID_PRIVATE_KEY'?null:values[k]},fetcher:async u=>{calls.push(u);return Response.json(true);}});
 assert.equal((await handler(request())).status,503);assert.equal(calls.length,1);
});
