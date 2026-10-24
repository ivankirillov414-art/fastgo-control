import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {liveWarehouse} from '../supabase/functions/fastgo-warehouse/live.js';
import {deviceStatus} from '../supabase/functions/fastgo-warehouse/device-status.js';

test('inactive empty native templates are acknowledged without reopening a laptop or changing stock',async()=>{
 const calls=[],db=async(...args)=>{calls.push(args);return [];};
 const p={request_id:randomUUID(),kind:'receipt',revision:1,items:[]};
 const result=await liveWarehouse('draft_sync',p,{db,actor:{id:randomUUID()},device:{id:randomUUID(),kind:'terminal'},stationId:randomUUID()});
 assert.equal(result.state,'queued');assert.equal(result.payload.revision,1);assert.equal(calls.length,1);assert.equal(calls[0][2],undefined);
});
test('explicitly opened empty documents, notes and real scans still reach the laptop',async()=>{
 for(const extra of [{active:true},{note:'Supplier note'},{revision:2},{items:[{part_id:randomUUID(),quantity:1}]}]){
  const writes=[],db=async(...args)=>{if(args[2])writes.push(args);return [];};
  await liveWarehouse('draft_sync',{request_id:randomUUID(),kind:'receipt',revision:1,items:[],...extra},{db,actor:{id:randomUUID()},device:{id:randomUUID(),kind:'terminal'},stationId:randomUUID()});
  assert.equal(writes.length,1);assert.equal(writes[0][0],'workshop_warehouse_queue');
 }
});
test('acknowledging a blank template cannot revive a cancelled document',async()=>{
 const id=randomUUID(),terminal=randomUUID(),stationId=randomUUID();
 const db=async()=>[{id,terminal_id:terminal,state:'done',payload:{live:true,kind:'receipt',revision:1,items:[]},result:{cancelled:true}}];
 await assert.rejects(()=>liveWarehouse('draft_sync',{request_id:id,kind:'receipt',revision:1,items:[]},{db,actor:{},device:{id:terminal,kind:'terminal'},stationId}),e=>e.status===409);
});
test('installation receipt is bound to the authenticated device and drops extra data and credentials',async()=>{
 const device={id:randomUUID(),kind:'terminal'},stationId=randomUUID(),writes=[];
 const result=await deviceStatus('device_status',{app:'tsd',version:'2.1.4',version_code:7,pending_documents:0,device_id:'forged',station_id:'forged',host:'iData',update_status:'current',password:'secret',details:{customer:'private'},device_token:'secret'},{device,stationId,db:async(...args)=>{writes.push(args);}});
 const row=writes[0][3];assert.equal(result.version,'2.1.4');assert.equal(row.device_id,device.id);assert.equal(row.station_id,stationId);assert.equal(row.details.version_code,7);assert.equal(row.pending_documents,0);assert.ok(!JSON.stringify(row).includes('secret'));assert.ok(!JSON.stringify(row).includes('private'));assert.match(writes[0][4],/merge-duplicates/);
});
test('receipt rejects forged app kinds, invalid counts and malformed versions',async()=>{
 const noWrites=async()=>assert.fail('invalid receipt must not reach storage');
 for(const p of [{app:'desktop',version:'2.1.4'},{app:'tsd',version:'invalid'},{app:'tsd',version:'2.1.4',pending_documents:-1},{app:'other',version:'1.0.0'}])await assert.rejects(()=>deviceStatus('device_status',p,{db:noWrites,device:{id:randomUUID(),kind:'terminal'},stationId:randomUUID()}));
 assert.equal(await deviceStatus('catalog',{},{}),undefined);
});
test('warehouse network receipt stores bounded aggregate fields and drops private network details',async()=>{
 const writes=[],network={sampled_at:'2026-10-24T11:30:00Z',online:true,wifi_signal_percent:28,disconnects_24h:3,api_ok:true,feed_ok:true,download_ok:false,download_bytes_per_second:262144,stalled_seconds:50,codes:['weak_wifi','download_stalled','forged'],ssid:'PRIVATE_SSID',ipv4:'PRIVATE_IP',password:'PRIVATE_PASSWORD',events:['PRIVATE_EVENT']};
 await deviceStatus('device_status',{app:'warehouse',version:'1.0.19',network},{device:{id:randomUUID(),kind:'desktop'},stationId:randomUUID(),db:async(...args)=>writes.push(args)});
 const details=writes[0][3].details;assert.equal(details.network.wifi_signal_percent,28);assert.deepEqual(details.network.codes,['weak_wifi','download_stalled']);assert(!JSON.stringify(details).includes('PRIVATE_'));
 network.wifi_signal_percent=101;network.stalled_seconds=-1;network.download_bytes_per_second=Infinity;network.online='true';network.sampled_at='bad';writes.length=0;
 await deviceStatus('device_status',{app:'warehouse',version:'1.0.19',network},{device:{id:randomUUID(),kind:'desktop'},stationId:randomUUID(),db:async(...args)=>writes.push(args)});
 assert.equal(writes[0][3].details.network.online,null);assert.equal(writes[0][3].details.network.wifi_signal_percent,null);assert.equal(writes[0][3].details.network.stalled_seconds,null);assert.equal(writes[0][3].details.network.download_bytes_per_second,null);assert.equal(writes[0][3].details.network.sampled_at,null);
});
test('printer diagnostic receipt identifies the cash queues and saved label printer without arbitrary extra fields',async()=>{
 const writes=[],printing={printers:[{name:'P2',displayName:'DETONGER P2',status:0,isDefault:true,password:'PRIVATE'},null],profiles:{label:{deviceName:'P2',widthMm:50,heightMm:30},a4:{deviceName:'PRIVATE_A4'}},warning:'',token:'PRIVATE_TOKEN'};
 await deviceStatus('device_status',{app:'warehouse',version:'1.0.19',printing},{device:{id:randomUUID(),kind:'station'},stationId:randomUUID(),db:async(...args)=>writes.push(args)});
 const saved=writes[0][3].details.printing;assert.equal(saved.printers.length,1);assert.equal(saved.printers[0].name,'P2');assert.equal(saved.label.widthMm,50);assert.ok(!JSON.stringify(saved).includes('PRIVATE'));assert.ok(Number.isFinite(Date.parse(saved.sampled_at)));
});
