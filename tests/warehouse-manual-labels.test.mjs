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
 const status={station_id:station,last_seen:new Date().toISOString(),details:{printing:{label:{deviceName:'P2 Label Printer',widthMm:50,heightMm:27},printers:[{name:'P2 Label Printer'},{name:'4BARCODE 3B-365B'},{name:'Microsoft Print to PDF'},{name:'Fax'},{name:'EPSON L8050 Series'}]}}},statuses=[status],allowed=[{station_id:station}];
 const db=async(table,q='',method='GET',body)=>{
  if(table==='workshop_terminal_stations')return structuredClone(allowed);
  if(table==='workshop_warehouse_devices')return [{id:station,name:'Драгнир'},{id:other,name:'Чужой ноутбук'}];
  if(table==='workshop_device_status')return structuredClone(statuses);
  if(table==='rpc/workshop_native_snapshot')return structuredClone(snapshot);
  if(table!=='workshop_warehouse_queue')throw Error('Unexpected database access: '+table);
  const params=new URLSearchParams(q),id=params.get('id')?.slice(3),stationId=params.get('station_id')?.slice(3);
  const found=jobs.filter(x=>(!id||x.id===id)&&(!stationId||x.station_id===stationId));
  if(method==='POST'){if(jobs.some(x=>x.id===body.id))throw Object.assign(Error('conflict'),{status:409});jobs.push(structuredClone(body));writes++;if(lost){lost=false;throw Error('response lost');}return null;}
  if(method==='PATCH'){found.forEach(x=>Object.assign(x,body));return null;}
  return structuredClone(found);
 };
 const request=(action,p={},override=actor)=>manualLabels(action,p,{db,actor:override});
 return {actor,station,other,part,jobs,snapshot,status,statuses,allowed,db,request,get writes(){return writes;},loseReply:()=>lost=true};
}
test('phone sees both supported thermal queues on its allowed laptop with the saved default and exact names',async()=>{
 const h=fixture(),targets=await h.request('label_targets');assert.equal(targets.length,2);
 assert.deepEqual(targets.map(x=>[x.id,x.printer,x.displayName,x.isDefault]),[[h.station,'P2 Label Printer','P2 Label Printer',true],[h.station,'4BARCODE 3B-365B','POScenter PC-365',false]]);
 assert(targets.every(x=>x.online&&x.can_remember&&x.width_mm===50&&x.height_mm===27&&x.label_pipeline===3));assert.equal(h.writes,0);
 h.status.details.printing.label.deviceName='4BARCODE 3B-365B';assert.equal((await h.request('label_targets'))[0].printer,'4BARCODE 3B-365B');
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
test('an owner can test and remember PC365, while old workers cannot print it on P2',async()=>{
 const h=fixture(),p={request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:1,printer_name:'4BARCODE 3B-365B',remember_printer:true};
 await h.request('label_enqueue',p);assert.equal(h.jobs[0].result.printer_name,p.printer_name);assert.equal(h.jobs[0].result.remember_printer,true);
 const ctx={db:h.db,device:{kind:'station'},stationId:h.station};assert.equal((await receiptLabels('receipt_label_jobs',{},ctx)).length,0);assert.equal((await receiptLabels('receipt_label_jobs',{label_pipeline:2},ctx)).length,1);
 await assert.rejects(h.request('label_enqueue',{...p,printer_name:'Microsoft Print to PDF'}),e=>e.status===409);
 await assert.rejects(h.request('label_enqueue',{...p,request_id:randomUUID()},{...h.actor,role:'admin'}),e=>e.status===403);
 await assert.rejects(h.request('label_enqueue',{...p,request_id:randomUUID(),printer_name:'Missing printer'}),e=>e.status===409);
});

test('a fresh snapshot never resurrects old queues or virtual/A4 printers; offline targets retain their identity',async()=>{
 const h=fixture();h.status.details.printing.printers=[{name:'P2 Label Printer'},{name:'Microsoft Print to PDF'},{name:'Fax'},{name:'EPSON L8050 Series'}];
 h.statuses.push({station_id:h.station,last_seen:new Date(Date.now()-240000).toISOString(),details:{printing:{label:{deviceName:'4BARCODE 3B-365B'},printers:[{name:'4BARCODE 3B-365B'}]}}});
 assert.deepEqual((await h.request('label_targets')).map(x=>x.printer),['P2 Label Printer']);
 for(const printer_name of ['4BARCODE 3B-365B','Microsoft Print to PDF','Fax','EPSON L8050 Series'])await assert.rejects(h.request('label_enqueue',{request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:1,printer_name}),e=>e.status===409);
 h.status.last_seen=new Date(Date.now()-181000).toISOString();h.statuses.splice(1);const targets=await h.request('label_targets');assert.equal(targets[0].online,false);assert.equal(targets[0].id,h.station);assert.equal(h.writes,0);
});

test('an explicitly saved physical label queue remains available without guessing generic thermal capabilities',async()=>{
 const h=fixture();h.status.details.printing.printers.push({name:'Thermal_System_Queue'});
 assert(!(await h.request('label_targets')).some(x=>x.printer==='Thermal_System_Queue'));
 h.status.details.printing.label.deviceName='Thermal_System_Queue';assert.equal((await h.request('label_targets'))[0].printer,'Thermal_System_Queue');
 h.status.details.printing.label.deviceName='Microsoft Print to PDF';assert(!(await h.request('label_targets')).some(x=>x.printer==='Microsoft Print to PDF'));
 const admin=await h.request('label_targets',{}, {...h.actor,role:'admin'});assert(admin.every(x=>x.can_remember===false));
});

test('label dimensions travel with the exact printer and request; old workers cannot discard the format',async()=>{
 const h=fixture(),p={request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:3,printer_name:'4BARCODE 3B-365B',remember_printer:true,width_mm:50,height_mm:30};
 h.loseReply();await h.request('label_enqueue',p);assert.equal(h.writes,1);assert.equal(h.jobs[0].result.width_mm,50);assert.equal(h.jobs[0].result.height_mm,30);assert.equal(h.jobs[0].result.printer_name,p.printer_name);
 const ctx={db:h.db,device:{kind:'station'},stationId:h.station};
 for(const label_pipeline of [undefined,1,2])assert.equal((await receiptLabels('receipt_label_jobs',{label_pipeline},ctx)).length,0);
 assert.equal((await receiptLabels('receipt_label_jobs',{label_pipeline:3},ctx))[0].id,p.request_id);
 await assert.rejects(h.request('label_enqueue',{...p,height_mm:31}),e=>e.status===409);
 h.status.details.printing.printers=[];assert.equal((await h.request('label_enqueue',p)).id,p.request_id,'a known accepted request can be retried when discovery changes');assert.equal(h.writes,1);
});

test('partial, invalid or untargeted dimensions cannot queue a print or alter stock',async()=>{
 const h=fixture(),before=structuredClone(h.snapshot),p={request_id:randomUUID(),part_id:h.part,station_id:h.station,quantity:1,printer_name:'4BARCODE 3B-365B'};
 for(const dims of [{width_mm:50},{height_mm:30},{width_mm:null,height_mm:30},{width_mm:'50',height_mm:30},{width_mm:29,height_mm:30},{width_mm:111,height_mm:30},{width_mm:50,height_mm:19},{width_mm:50,height_mm:201},{width_mm:NaN,height_mm:30}])await assert.rejects(h.request('label_enqueue',{...p,...dims}),e=>e.status===400);
 await assert.rejects(h.request('label_enqueue',{...p,printer_name:undefined,width_mm:50,height_mm:30}),e=>e.status===400);
 assert.equal(h.writes,0);assert.deepEqual(h.snapshot,before);
});
