import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {manualLabels} from '../supabase/functions/fastgo-workshop-api/manual-labels.js';
import {receiptLabels} from '../supabase/functions/fastgo-warehouse/receipt-labels.js';

function fixture(){
 const actor={id:randomUUID(),role:'owner'},station=randomUUID(),other=randomUUID(),part=randomUUID(),jobs=[];
 const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url))),sheets=Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}]));
 sheets['Товары'].rows.push({product_id:part,'Модель / название':'Амортизатор','Штрих-код':'FGP-00000036','Остаток, шт.':44,'Цена продажи, ₽':1500,'Цена закупки, ₽':800,'Активен':true,__row:2});
 const snapshot={version:1,sheets};let writes=0,lost=false;
 const db=async(table,q='',method='GET',body)=>{
  if(table==='workshop_terminal_stations')return [{station_id:station}];
  if(table==='workshop_warehouse_devices')return [{id:station,name:'Драгнир'},{id:other,name:'Чужой ноутбук'}];
  if(table==='workshop_device_status')return [{station_id:station,last_seen:new Date().toISOString(),details:{printing:{label:{deviceName:'P2 Label Printer'}}}}];
  if(table==='rpc/workshop_native_snapshot')return structuredClone(snapshot);
  if(table!=='workshop_warehouse_queue')throw Error('Unexpected database access: '+table);
  const params=new URLSearchParams(q),id=params.get('id')?.slice(3),stationId=params.get('station_id')?.slice(3);
  const found=jobs.filter(x=>(!id||x.id===id)&&(!stationId||x.station_id===stationId));
  if(method==='POST'){if(jobs.some(x=>x.id===body.id))throw Object.assign(Error('conflict'),{status:409});jobs.push(structuredClone(body));writes++;if(lost){lost=false;throw Error('response lost');}return null;}
  if(method==='PATCH'){found.forEach(x=>Object.assign(x,body));return null;}
  return structuredClone(found);
 };
 const request=(action,p={},override=actor)=>manualLabels(action,p,{db,actor:override});
 return {actor,station,other,part,jobs,snapshot,db,request,get writes(){return writes;},loseReply:()=>lost=true};
}
test('phone sees only an authorized laptop with its configured printer',async()=>{
 const h=fixture(),targets=await h.request('label_targets');assert.deepEqual(targets,[{id:h.station,name:'Драгнир',printer:'P2 Label Printer',online:true}]);
 await assert.rejects(h.request('label_targets',{}, {...h.actor,role:'mechanic',can_edit_catalog:true}),e=>e.status===403);
});
test('44 labels are independent of stock; a lost enqueue reply and a retry create one job',async()=>{
 const h=fixture(),before=structuredClone(h.snapshot),p={request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:44};h.loseReply();
 const result=await h.request('label_enqueue',p);assert.equal(result.status,'pending');assert.equal((await h.request('label_enqueue',p)).id,p.request_id);assert.equal(h.writes,1);assert.deepEqual(h.snapshot,before);
 assert.equal(h.jobs[0].result.items[0].quantity,44);assert.equal(h.jobs[0].result.items[0].retail_price,1500);assert.equal(h.jobs[0].payload.kind,'labels');assert.equal(h.jobs[0].state,'done');
 await assert.rejects(h.request('label_enqueue',{...p,quantity:2}),e=>e.status===409);
 await assert.rejects(h.request('label_enqueue',p,{...h.actor,id:randomUUID()}),e=>e.status===409);
});
test('queue rejects invalid quantity, a foreign laptop and a missing product without stock writes',async()=>{
 const h=fixture(),p={request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:44};
 for(const quantity of [0,-1,1.5,1001,'44',null])await assert.rejects(h.request('label_enqueue',{...p,quantity}),e=>e.status===400);
 await assert.rejects(h.request('label_enqueue',{...p,station_id:h.other}),e=>e.status===403);
 await assert.rejects(h.request('label_enqueue',{...p,part_id:randomUUID()}),e=>e.status===404);assert.equal(h.writes,0);
});
test('existing cash receipt worker accepts and acknowledges mobile labels exactly once',async()=>{
 const h=fixture(),id=randomUUID();await h.request('label_enqueue',{request_id:id,part_id:h.part,station_id:h.station,quantity:6});
 const ctx={db:h.db,device:{kind:'station'},stationId:h.station};assert.equal((await receiptLabels('receipt_label_jobs',{},ctx))[0].id,id);
 await assert.rejects(receiptLabels('receipt_label_ack',{id},{...ctx,device:{kind:'terminal'}}),e=>e.status===403);
 assert.equal((await receiptLabels('receipt_label_ack',{id},ctx)).printed,true);assert.equal((await receiptLabels('receipt_label_ack',{id},ctx)).printed,true);
 assert.equal((await h.request('label_enqueue',{request_id:id,part_id:h.part,station_id:h.station,quantity:6})).status,'printed');assert.equal(h.writes,1);
});
