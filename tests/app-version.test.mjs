import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVersionHandler,versionState} from '../supabase/functions/fastgo-app-version/handler.js';
const actor='00000000-0000-4000-8000-000000000001',device='00000000-0000-4000-8000-000000000002';
const request=p=>new Request('https://test',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify(p)});
test('version ordering is numeric',()=>{assert.equal(versionState('1.0.9','1.0.10'),'outdated');assert.equal(versionState('1.0.10','1.0.9'),'ahead');assert.equal(versionState('1.0.4','1.0.4'),'current');assert.equal(versionState('1.0.4',null),'unknown');});
test('report is bound to verified user and official release; no arbitrary data is stored',async()=>{
 let saved;
 const handler=createVersionHandler({base:'https://db',key:'secret',fetcher:async(url,p)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:actor});
  if(url.includes('workshop_members'))return Response.json([{profile_id:actor}]);
  if(url.startsWith('https://api.github.com'))return Response.json([{tag_name:'fastgo-windows-v1.0.10',assets:[{name:'latest.yml'}]},{tag_name:'fastgo-windows-v1.0.11',draft:true,assets:[{name:'latest.yml'}]}]);
  saved=JSON.parse(p.body);return new Response(null,{status:201});
 }});
 const response=await handler(request({device_id:device,version:'1.0.4',actor_id:'attacker',repair:'private'}));assert.equal(response.status,200);assert.equal(saved.actor_id,actor);assert.equal(saved.latest_version,'1.0.10');assert.equal(saved.update_state,'outdated');assert.equal(Object.hasOwn(saved,'repair'),false);
});
test('anonymous, inactive and invalid reports cannot write',async()=>{
 let writes=0;const handler=createVersionHandler({base:'https://db',key:'secret',fetcher:async(url)=>{if(url.endsWith('/user'))return Response.json({id:actor});if(url.includes('members'))return Response.json([]);writes++;return Response.json({});}});
 assert.equal((await handler(new Request('https://test',{method:'POST',body:'{}'}))).status,401);assert.equal((await handler(request({device_id:device,version:'1.0.4'}))).status,403);assert.equal(writes,0);
});
