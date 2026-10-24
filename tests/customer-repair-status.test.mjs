import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStatusHandler,clientStage} from '../supabase/functions/fastgo-repair-status/handler.js';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const request=p=>new Request('https://test/status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer staff'},body:JSON.stringify(p)});
test('only a scoped, signed link returns the two allowed fields',async()=>{
 let dbReads=0;
 const handler=createStatusHandler({base:'https://test',key:'test-secret',fetcher:async(url,options)=>{
  if(url.includes('fastgo-workshop-api')){assert.equal(JSON.parse(options.body).params.id,id);return Response.json({data:{record:{id}}});}
  dbReads++;const q=new URL(url).searchParams;assert.equal(q.get('data->>repair_id'),'eq.'+id);assert.equal(q.get('select'),'status:data->>Статус,number:data->>Номер ремонта');return Response.json([{status:'В ремонте',number:'FGR-0011',phone:'PRIVATE',parts:['PRIVATE']}]);
 }});
 const issued=await (await handler(request({action:'issue',id}))).json();
 const result=await (await handler(request({token:issued.data.token}))).json();
 assert.deepEqual(result,{data:{number:'0011',stage:'repair'}});
 assert.equal((await handler(request({token:issued.data.token.replace(id,other)}))).status,404);
 assert.equal((await handler(request({token:id+'.'+'0'.repeat(64)}))).status,404);
 assert.equal((await handler(request({id}))).status,404);assert.equal(dbReads,1);
});
test('issuing a link requires staff access to that exact repair',async()=>{
 const handler=createStatusHandler({base:'https://test',key:'test-secret',fetcher:async()=>Response.json({error:'denied'},{status:403})});
 assert.equal((await handler(request({action:'issue',id}))).status,403);
 assert.equal((await handler(new Request('https://test',{method:'POST',body:JSON.stringify({action:'issue',id})}))).status,401);
});
test('all repair stages map without returning parts',()=>{
 for(const [raw,expected] of Object.entries({'Принят':'accepted','Диагностика':'diagnostics','Ждём запчасти':'waiting','В ремонте':'repair','Готов':'ready','Выдан':'issued','Отменён':'cancelled'}))assert.equal(clientStage(raw),expected);
});

test('old paper UUID shows only public stage, while authenticated staff gets its exact card',async()=>{
 let staff=false;const handler=createStatusHandler({base:'https://test',key:'test-secret',fetcher:async(url,options)=>{
  if(url.includes('fastgo-workshop-api'))return staff?Response.json({data:{record:{id,parts:['PRIVATE']}}}):Response.json({error:'denied'},{status:401});
  const q=new URL(url).searchParams;assert.equal(q.get('select'),'status:data->>Статус,number:data->>Номер ремонта');assert.equal(q.get('data->>repair_id'),'eq.'+id);return Response.json([{status:'Готов',number:'FGR-0044',phone:'PRIVATE'}]);
 }});
 const anonymous=new Request('https://test',{method:'POST',body:JSON.stringify({action:'open',legacy_id:id})});assert.deepEqual(await (await handler(anonymous)).json(),{data:{number:'0044',stage:'ready'}});
 assert.deepEqual(await (await handler(request({action:'open',legacy_id:id}))).json(),{data:{number:'0044',stage:'ready'}});
 staff=true;assert.deepEqual(await (await handler(request({action:'open',legacy_id:id}))).json(),{data:{staff_url:'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+id}});
});
