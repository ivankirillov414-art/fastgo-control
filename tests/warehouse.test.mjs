import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {createHandler,digest} from '../supabase/functions/fastgo-warehouse/handler.js';
import {masterIssue,items,masterHoldings} from '../supabase/functions/fastgo-warehouse/model.js';
const actor=randomUUID(),master=randomUUID(),part=randomUUID(),station=randomUUID(),terminal=randomUUID();
function snapshot(){const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));schema['Фото товаров']=['photo_id','product_id','category','path','created_at','sha256'];const sheets=Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}]));const seed=(name,p)=>sheets[name].rows.push({...Object.fromEntries(sheets[name].headers.map(x=>[x,''])),__row:sheets[name].rows.length+2,...p});seed('Товары',{product_id:part,'Модель / название':'Колодки','Штрих-код':'FGP-00000001','Остаток, шт.':5,'Цена закупки, ₽':100,'Цена продажи, ₽':300,'Активен':true});seed('Сотрудники',{employee_id:master,'ФИО':'Тестовый мастер','Роль':'Механик','Активен':true});return{version:1,sheets};}
test('zero payment atomically removes stock and records master assignment without cash revenue',()=>{const s=snapshot(),r=masterIssue(s,{request_id:randomUUID(),master_id:master,items:[{part_id:part,quantity:2}]},{id:actor,role:'owner'});assert.equal(s.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.equal(r.changes.find(x=>x.sheet==='Товары').values['Остаток, шт.'],3);assert.equal(r.changes.filter(x=>x.sheet==='Продажи'||x.sheet==='Оплаты').length,0);assert.equal(r.result.amount,0);const event=r.changes.find(x=>x.sheet==='События');assert.equal(JSON.parse(event.values['Детали']).master_id,master);assert.equal(r.changes.find(x=>x.sheet==='Движения склада').values['Тип'],'Расход');const sheets=structuredClone(s.sheets);sheets['События'].rows.push(event.values);assert.equal(masterHoldings(sheets)[0].quantity,2);});
test('master issue rejects insufficient stock, inactive/non-master recipient and unprivileged caller',()=>{const p={request_id:randomUUID(),master_id:master,items:[{part_id:part,quantity:9}]};assert.throws(()=>masterIssue(snapshot(),p,{id:actor,role:'owner'}),/Недостаточно/);assert.throws(()=>masterIssue(snapshot(),{...p,master_id:randomUUID()},{id:actor,role:'owner'}),/активного мастера/);assert.throws(()=>masterIssue(snapshot(),p,{id:actor,role:'mechanic'}),/Нет права/);assert.deepEqual(items([{part_id:part,quantity:2},{part_id:part,quantity:1}]),[{part_id:part,quantity:3}]);assert.throws(()=>items([{part_id:part,quantity:-1}]),/количество/);});
async function harness(){let snap=snapshot();const devices=[{id:station,kind:'station',active:true,name:'Склад',token_hash:await digest('station-token')},{id:terminal,kind:'terminal',active:true,station_id:station,token_hash:await digest('terminal-token')}],queue=[],receipts=[],member={profile_id:actor,role:'owner',name:'Тест',active:true};let lost=false;
const fetcher=async(url,opt={})=>{const u=new URL(url),body=opt.body?JSON.parse(opt.body):null;const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});if(u.pathname==='/auth/v1/user')return respond({id:actor,email:'test@example.invalid'});const path=u.pathname.replace('/rest/v1/','');let list;if(path==='workshop_members')list=[member,{profile_id:master,role:'mechanic',active:true}];else if(path==='workshop_warehouse_devices')list=devices;else if(path==='workshop_warehouse_queue')list=queue;else if(path==='workshop_native_receipts')list=receipts;
if(path==='rpc/workshop_native_snapshot')return respond(structuredClone(snap));
if(path==='rpc/workshop_native_commit'){if(member.role==='seller'&&!['stock_receive','sale','shift_open','shift_close','warehouse_repair_payment'].includes(body.p_action))return respond({message:'Нет доступа'},403);const old=receipts.find(x=>x.request_id===body.p_request_id);if(old){assert.equal(old.fingerprint,body.p_fingerprint);return respond({result:old.result});}if(snap.version!==body.p_version)return respond({retry:true});for(const x of body.p_changes){let r=snap.sheets[x.sheet].rows.find(y=>y.__row===x.row);if(!r){r={__row:x.row};snap.sheets[x.sheet].rows.push(r);}Object.assign(r,x.values);}snap.version++;receipts.push({request_id:body.p_request_id,actor_id:body.p_actor,action:body.p_action,fingerprint:body.p_fingerprint,result:body.p_result});return respond({result:body.p_result});}
if(!list)throw Error(path);const matches=r=>[...u.searchParams].every(([k,v])=>{if(['select','limit','order'].includes(k))return true;if(v.startsWith('eq.'))return String(k.includes('->>')?r[k.split('->>')[0]]?.[k.split('->>')[1]]:r[k])===v.slice(3);if(v.startsWith('neq.'))return String(r[k])!==v.slice(4);if(v==='is.null')return r[k]==null;return true;});if(opt.method==='POST'){list.push({active:true,...body,state:body.state||'queued'});return new Response(null,{status:201});}if(opt.method==='PATCH'){if(path==='workshop_warehouse_queue'&&body.state==='done'&&lost){lost=false;throw Error('response lost');}const found=list.filter(matches);found.forEach(x=>Object.assign(x,body));return opt.headers.Prefer?respond(structuredClone(found)):new Response(null,{status:204});}return respond(structuredClone(list.filter(matches)));};
const handler=createHandler({base:'https://test.invalid',key:'test',fetcher});const request=async(action,p={},kind='station')=>{const r=await handler(new Request('https://test.invalid/warehouse',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,device_id:kind==='station'?station:terminal,device_token:kind+'-token',...p})}));return {status:r.status,...await r.json()};};return{request,queue,receipts,devices,member,get snap(){return snap;},loseCompletion:()=>lost=true};}
test('terminal routes only to paired station, cannot checkout, and retrying one basket never duplicates it',async()=>{const h=await harness(),request_id=randomUUID(),p={request_id,items:[{part_id:part,quantity:1}]};assert.equal((await h.request('enqueue',p,'terminal')).status,200);assert.equal(h.queue[0].station_id,station);assert.equal((await h.request('enqueue',p,'terminal')).status,200);assert.equal(h.queue.length,1);assert.equal((await h.request('checkout',{id:request_id},'terminal')).status,403);assert.equal((await h.request('queue',{},'terminal')).status,403);assert.equal((await h.request('queue',{device_id:randomUUID()})).status,403);});
test('lost completion response retries original zero-payment issue exactly once',async()=>{const h=await harness(),request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:2}]},'terminal');h.loseCompletion();const p={id:request_id,mode:'master',master_id:master,items:[{part_id:part,unit_price:300}]};assert.equal((await h.request('checkout',p)).status,503);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal((await h.request('checkout',p)).status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal(h.receipts.length,1);assert.equal(h.queue[0].state,'done');assert.equal(h.snap.sheets['Продажи'].rows.length,0);});
test('cash sale retries only once and master assignments are owner-only',async()=>{const h=await harness();const opened=await h.request('shift_open',{request_id:randomUUID(),register:'Склад',opening_cash:0});assert.equal(opened.status,200);const request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:1}]},'terminal');const p={id:request_id,mode:'sale',shift_id:opened.data.id,payment_method:'cash',items:[{part_id:part,unit_price:250}]};h.loseCompletion();assert.equal((await h.request('checkout',p)).status,503);assert.equal((await h.request('checkout',p)).status,200);assert.equal(h.snap.sheets['Продажи'].rows.length,1);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],4);h.member.role='seller';assert.equal((await h.request('holdings')).status,403);});
test('invalid master is rejected before freezing a basket and revocation stops a paired terminal',async()=>{const h=await harness(),request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:1}]},'terminal');assert.equal((await h.request('checkout',{id:request_id,mode:'master',master_id:randomUUID(),items:[{part_id:part,unit_price:0}]})).status,400);assert.equal(h.queue[0].state,'queued');h.devices[0].active=false;assert.equal((await h.request('catalog',{},'terminal')).status,403);});

test('station registration accepts a real empty PostgREST 201 and returns usable binding',async()=>{const h=await harness();const r=await h.request('register',{name:'Склад тест'});assert.equal(r.status,200);assert.ok(r.data.token);const device=h.devices.find(d=>d.id===r.data.id);assert.equal(device.name,'Склад тест');assert.equal(device.token_hash,await digest(r.data.token));const info=await h.request('info',{device_id:r.data.id,device_token:r.data.token});assert.equal(info.status,200);assert.equal(info.data.device.name,'Склад тест');const code=await h.request('pair_code',{device_id:r.data.id,device_token:r.data.token});assert.equal(code.status,200);assert.ok(code.data.code);});

test('code-free terminal connection requires membership, exposes only station labels and retries once',async()=>{
 const h=await harness(),r=await h.request('stations');assert.equal(r.status,200);assert.equal(r.data.length,1);assert.equal(r.data[0].id,station);assert.equal(r.data[0].token_hash,undefined);
 const p={station_id:station,terminal_id:randomUUID(),token:randomUUID()+randomUUID()};
 const connected=await h.request('connect_terminal',p);assert.equal(connected.status,200);assert.equal(connected.data.station_id,station);assert.equal((await h.request('connect_terminal',p)).status,200);assert.equal(h.devices.filter(x=>x.id===p.terminal_id).length,1);
 const request_id=randomUUID();assert.equal((await h.request('enqueue',{device_id:p.terminal_id,device_token:p.token,request_id,items:[{part_id:part,quantity:1}]})).status,200);assert.equal(h.queue[0].station_id,station);
 assert.equal((await h.request('connect_terminal',{...p,token:randomUUID()+randomUUID()})).status,409);
 assert.equal((await h.request('connect_terminal',{...p,terminal_id:station})).status,409);
 assert.equal((await h.request('connect_terminal',{...p,station_id:terminal})).status,404);
 h.devices[0].active=false;assert.equal((await h.request('connect_terminal',{...p,terminal_id:randomUUID()})).status,404);
 h.member.role='mechanic';assert.equal((await h.request('stations')).status,403);assert.equal((await h.request('connect_terminal',p)).status,403);
});
test('code-free connection never accepts a request without a user session',async()=>{
 const handler=createHandler({base:'https://test.invalid',key:'test',fetcher:async()=>{throw Error('must not reach database');}});
 const r=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'connect_terminal'})}));assert.equal(r.status,401);
});


test('live empty basket reaches its station, revision never rolls back and old checkout cannot charge it',async()=>{
 const h=await harness(),request_id=randomUUID();
 assert.equal((await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[]},'terminal')).status,200);
 assert.equal((await h.request('live_jobs')).data.length,1);
 assert.equal((await h.request('draft_sync',{request_id,kind:'sale',revision:2,items:[{part_id:part,quantity:2}]},'terminal')).status,200);
 await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[]},'terminal');assert.equal(h.queue[0].payload.items[0].quantity,2);
 assert.equal((await h.request('queue')).data.length,0);
 assert.equal((await h.request('checkout',{id:request_id})).status,409);
 assert.equal((await h.request('live_pay',{id:request_id,revision:1,payment_method:'cash'},'terminal')).status,409);
 assert.equal(h.snap.sheets['Продажи'].rows.length,0);
});
for(const method of ['cash','card','transfer'])test('terminal '+method+' payment atomically opens shift and retries once after lost response',async()=>{
 const h=await harness(),request_id=randomUUID();
 await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[{part_id:part,quantity:2,custom_price:true,unit_price:250.50}]},'terminal');
 h.loseCompletion();const p={id:request_id,revision:1,payment_method:method};
 assert.equal((await h.request('live_pay',p,'terminal')).status,503);
 assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);
 const retry=await h.request('live_pay',p,'terminal');assert.equal(retry.status,200);assert.equal(retry.data.total,501);
 assert.equal(h.snap.sheets['Продажи'].rows.length,1);assert.equal(h.snap.sheets['События'].rows.filter(x=>x['Действие']==='shift_open').length,1);
 assert.equal(h.snap.sheets['Продажи'].rows[0]['Способ оплаты'],{cash:'Наличные',card:'Карта',transfer:'Перевод'}[method]);
 assert.equal((await h.request('draft_sync',{request_id,kind:'sale',revision:2,items:[]},'terminal')).status,409);
});
test('live base price, receipt, cancellation and terminal isolation',async()=>{
 const h=await harness(),request_id=randomUUID();
 await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[{part_id:part,quantity:1}]},'terminal');
 const sale=await h.request('live_pay',{id:request_id,revision:1,payment_method:'card'},'terminal');assert.equal(sale.status,200);assert.equal(sale.data.total,300);
 const receipt=randomUUID();await h.request('draft_sync',{request_id:receipt,kind:'receipt',revision:1,items:[{part_id:part,quantity:3}]},'terminal');
 const received=await h.request('live_receive',{id:receipt,revision:1},'terminal');assert.equal(received.status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],7);
 await h.request('live_receive',{id:receipt,revision:1},'terminal');assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],7);
 const empty=randomUUID();await h.request('draft_sync',{request_id:empty,kind:'sale',revision:1,items:[]},'terminal');
 assert.equal((await h.request('draft_close',{id:empty},'terminal')).status,200);assert.equal((await h.request('live_pay',{id:empty,revision:1,payment_method:'cash'},'terminal')).data.cancelled,true);
 const other=randomUUID();h.devices.push({id:other,kind:'terminal',station_id:station,active:true,token_hash:await digest('other')});
 assert.equal((await h.request('live_pay',{id:request_id,device_id:other,device_token:'other',revision:1,payment_method:'cash'},'terminal')).status,403);
});

test('seller can commit live sale and receipt through the database action allowlist',async()=>{const h=await harness();h.member.role='seller';for(const kind of ['sale','receipt']){const request_id=randomUUID();await h.request('draft_sync',{request_id,kind,revision:1,items:[{part_id:part,quantity:1}]},'terminal');const r=await h.request(kind==='sale'?'live_pay':'live_receive',{id:request_id,revision:1,payment_method:'cash'},'terminal');assert.equal(r.status,200,r.error);}});

test('laptop can own USB scans but cannot overwrite a terminal snapshot',async()=>{
 const h=await harness(),usb=randomUUID(),remote=randomUUID();
 assert.equal((await h.request('draft_sync',{request_id:usb,kind:'receipt',revision:1,items:[{part_id:part,quantity:1}]})).status,200);
 assert.equal(h.queue[0].terminal_id,station);
 await h.request('draft_sync',{request_id:remote,kind:'receipt',revision:1,items:[{part_id:part,quantity:1}]},'terminal');
 assert.equal((await h.request('draft_sync',{request_id:remote,kind:'receipt',revision:2,items:[{part_id:part,quantity:99}]})).status,403);
 assert.equal((await h.request('draft_close',{id:remote})).status,403);
 assert.equal((await h.request('draft_close',{id:usb})).status,200);
});
test('laptop receipt quantities are committed once, with a frozen retry after a lost response',async()=>{
 const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'receipt',revision:2,items:[{part_id:part,quantity:2}]},'terminal');h.loseCompletion();
 const p={id,revision:2,items:[{part_id:part,quantity:6}]};assert.equal((await h.request('live_receive',p)).status,503);
 assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],11);
 assert.equal((await h.request('live_receive',{...p,items:[{part_id:part,quantity:99}]})).status,200);
 assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],11);assert.equal(h.receipts.length,1);assert.equal(h.queue[0].checkout.items[0].quantity,6);
});
test('receipt rejects stale scans, replaced goods, invalid quantities and terminal overrides before mutation',async()=>{
 const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'receipt',revision:3,items:[{part_id:part,quantity:2}]},'terminal');
 for(const [payload,status,kind] of [
  [{id,revision:2,items:[{part_id:part,quantity:5}]},409,'station'],
  [{id,revision:3,items:[{part_id:randomUUID(),quantity:5}]},409,'station'],
  [{id,revision:3,items:[{part_id:part,quantity:0}]},400,'station'],
  [{id,revision:3,items:[{part_id:part,quantity:5}]},403,'terminal']
 ])assert.equal((await h.request('live_receive',payload,kind)).status,status);
 assert.equal(h.queue[0].state,'queued');assert.equal(h.receipts.length,0);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],5);
});

test('repair transfer payment writes the existing ledger exactly once',async()=>{
 const h=await harness(),repairId=randomUUID(),request_id=randomUUID();
 h.snap.sheets['Ремонты'].rows.push({__row:2,repair_id:repairId,'Номер ремонта':26,'Статус':'В ремонте','Итого':1500,'Оплачено':500,revision:2});
 const q=await h.request('repair_quote',{repair_id:repairId});assert.equal(q.status,200,q.error);assert.equal(q.data.due,1000);
 assert.equal((await h.request('enqueue_repair',{request_id,repair_id:repairId},'terminal')).status,200);
 const p={id:request_id,payment_method:'transfer',amount:1000,expected_revision:q.data.revision};h.loseCompletion();
 assert.equal((await h.request('checkout',p)).status,503);assert.equal((await h.request('checkout',p)).status,200);
 assert.equal(h.snap.sheets['Оплаты'].rows.length,1);assert.equal(h.snap.sheets['Оплаты'].rows[0]['Способ оплаты'],'transfer');assert.equal(h.snap.sheets['Ремонты'].rows[0]['Оплачено'],1500);
});
