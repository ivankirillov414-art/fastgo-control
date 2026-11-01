import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../supabase/functions/fastgo-print-api/index.ts',import.meta.url),'utf8');
function harness(role='owner'){
 let handler;const calls=[],actor=randomUUID();
 const fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:actor});
  if(url.includes('/rest/v1/workshop_members'))return Response.json([{role}]);
  if(url.includes('/functions/v1/fastgo-workshop-api'))return Response.json({data:{record:{status:'issued'}}});
  if(url.includes('/rest/v1/rpc/workshop_print_queue')){const body=JSON.parse(options.body);calls.push(body);return Response.json(body.p_action==='status'?{enabled:true}:{job:null});}
  throw Error('Unexpected URL '+url);
 };
 vm.runInNewContext(source,{Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://fixture.supabase.co':'fixture-private-key'},serve:fn=>handler=fn},fetch,Response,AbortSignal,Error});
 return {calls,actor,run:async(action,params)=>{const response=await handler(new Request('https://fixture/print',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action,params})}));return {status:response.status,body:await response.json()};}};
}
test('edge API forwards native completion capabilities and trusted actor, legacy calls stay master-only',async()=>{
 const api=harness(),station=randomUUID(),request=randomUUID();
 assert.equal((await api.run('claim',{station_id:station,request_id:request,document_types:['master','completion'],client_version:'1.0.70',host:'Service',printer_name:'A4',actor:randomUUID()})).status,200);
 assert.equal(api.calls[0].p_actor,api.actor);assert.deepEqual(api.calls[0].p_document_types,['master','completion']);assert.equal(api.calls[0].p_client_version,'1.0.70');
 assert.equal((await api.run('claim',{station_id:station,request_id:request})).status,200);assert.deepEqual(api.calls[1].p_document_types,['master']);
});
test('edge API verifies card access and forwards completion purpose, rejecting invalid protocol before RPC',async()=>{
 const api=harness();
 assert.equal((await api.run('enqueue',{kind:'repair',id:randomUUID(),request_id:randomUUID(),document_type:'completion'})).status,200);
 assert.equal(api.calls.at(-1).p_document_type,'completion');const before=api.calls.length;
 assert.equal((await api.run('claim',{station_id:randomUUID(),request_id:randomUUID(),document_types:['contract']})).status,400);assert.equal(api.calls.length,before);
 assert.equal((await api.run('enqueue',{document_type:'unknown'})).status,400);
 assert.equal((await harness('seller').run('claim',{station_id:randomUUID(),request_id:randomUUID()})).status,403);
});
