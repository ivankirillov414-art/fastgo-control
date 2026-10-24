import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {randomUUID} from 'node:crypto';
import {createHandler,digest} from '../supabase/functions/fastgo-warehouse/handler.js';
import {cancelDocument} from '../supabase/functions/fastgo-warehouse/cancel.js';
import {masterIssue,items,masterHoldings} from '../supabase/functions/fastgo-warehouse/model.js';
function seedRepair(h){const id=randomUUID();h.snap.sheets['Ремонты'].rows.push({__row:2,repair_id:id,'Номер ремонта':26,'Статус':'В ремонте','Итого':1500,'Оплачено':500,revision:2});return id;}
test('cash repair final price and discounted balance commit together and retry the frozen amount once',async()=>{
 for(const total of [750.45,1800]){
  const h=await harness(),repair=seedRepair(h),request_id=randomUUID(),raw=h.snap.sheets['Ремонты'].rows[0];raw['Стоимость работ']=1500;
  await h.request('enqueue_repair',{request_id,repair_id:repair},'terminal');h.loseCompletion();
  const p={id:request_id,payment_method:'card',amount:Math.round((total-500)*100)/100,expected_revision:2,total_override:total};
  assert.equal((await h.request('checkout',p)).status,503);
  const result=await h.request('checkout',{...p,total_override:999,amount:499});assert.equal(result.status,200,result.error);
  assert.equal(result.data.total,total);assert.equal(result.data.amount,p.amount);assert.equal(h.snap.sheets['Оплаты'].rows.length,1);
  const saved=h.snap.sheets['Ремонты'].rows[0];assert.equal(saved['Итого'],total);assert.equal(JSON.parse(h.snap.sheets['События'].rows[0]['Детали']).total_override,total);assert.equal(saved['Оплачено'],total);assert.equal(saved.revision,3);assert.equal(saved['Скидка'],Math.max(0,Math.round((1500-total)*100)/100));
  assert.equal(h.snap.sheets['Оплаты'].rows[0]['Сумма'],p.amount);assert.match(h.snap.sheets['Оплаты'].rows[0]['Комментарий'],/Итого вручную/);
 }
});
test('repair price edits reject malformed, stale, overpaid, closed and terminal requests before recording payment',async()=>{
 const h=await harness(),repair=seedRepair(h),request_id=randomUUID();await h.request('enqueue_repair',{request_id,repair_id:repair},'terminal');
 const p={id:request_id,payment_method:'cash',amount:500,expected_revision:2,total_override:1000};
 for(const total_override of [-1,'1000',null,.001,100000001])assert.equal((await h.request('checkout',{...p,total_override})).status,400);
 for(const patch of [{total_override:499,amount:-1},{expected_revision:1},{amount:1000}])assert.equal((await h.request('checkout',{...p,...patch})).status,409);
 assert.equal((await h.request('checkout',p,'terminal')).status,403);
 h.snap.sheets['Ремонты'].rows[0]['Статус']='Выдан';assert.equal((await h.request('checkout',p)).status,409);
 assert.equal(h.receipts.length,0);assert.equal(h.queue[0].checkout,undefined);assert.equal(h.snap.sheets['Оплаты'].rows.length,0);
});
test('zero estimate can receive an explicit final cost at checkout',async()=>{
 const h=await harness(),repair=seedRepair(h),request_id=randomUUID(),raw=h.snap.sheets['Ремонты'].rows[0];raw['Итого']=0;raw['Оплачено']=0;
 await h.request('enqueue_repair',{request_id,repair_id:repair},'terminal');const result=await h.request('checkout',{id:request_id,payment_method:'transfer',amount:600.01,total_override:600.01,expected_revision:2});assert.equal(result.status,200,result.error);assert.equal(result.data.total,600.01);
});
const repairCode=id=>'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+id;
for(const kind of ['receipt','sale','repair'])test('TSD cancellation of '+kind+' survives offline first delivery and rejects late replays',async()=>{
 const h=await harness(),id=randomUUID();const cancelled=await h.request('cancel_document',{id,kind,revision:2},'terminal');assert.equal(cancelled.status,200,cancelled.error);assert.equal(cancelled.data.result.cancelled,true);
 assert.equal((await h.request('cancel_document',{id,kind,revision:2},'terminal')).status,200);assert.equal(h.queue.length,1);assert.equal(h.queue[0].state,'done');
 if(kind!=='repair')assert.equal((await h.request('draft_sync',{request_id:id,kind,revision:3,items:[{part_id:part,quantity:1}]},'terminal')).status,409);
 assert.equal(h.receipts.length,0);assert.equal(h.snap.sheets['Оплаты'].rows.length,0);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],5);
});
test('TSD cancels its own queued repair but cannot cancel another terminal or an ongoing checkout',async()=>{
 const h=await harness(),repair=seedRepair(h),id=randomUUID();await h.request('enqueue_repair',{request_id:id,repair_id:repair},'terminal');
 h.queue[0].terminal_id=randomUUID();assert.equal((await h.request('cancel_document',{id,kind:'repair',revision:1},'terminal')).status,403);h.queue[0].terminal_id=terminal;h.queue[0].state='processing';h.queue[0].checkout={actor_id:actor};
 assert.equal((await h.request('cancel_document',{id,kind:'repair',revision:1},'terminal')).status,409);h.queue[0].state='queued';h.queue[0].checkout=null;
 assert.equal((await h.request('cancel_document',{id,kind:'repair',revision:1},'terminal')).data.result.cancelled,true);
 assert.equal(h.snap.sheets['Оплаты'].rows.length,0);
});
test('zero-value repair still reaches the laptop, while payment remains forbidden',async()=>{
 const h=await harness(),repair=seedRepair(h),id=randomUUID();h.snap.sheets['Ремонты'].rows[0]['Итого']=0;h.snap.sheets['Ремонты'].rows[0]['Оплачено']=0;
 assert.equal((await h.request('enqueue_repair',{request_id:id,repair_id:repair},'terminal')).status,200);assert.equal((await h.request('queue')).data[0].payload.repair.payable,false);
 const scan=await h.request('scan_unknown',{request_id:randomUUID(),document_id:randomUUID(),kind:'sale',code:repairCode(repair)},'terminal');assert.equal(scan.status,200,scan.error);assert.equal(scan.data.payload.kind,'repair');
 assert.equal((await h.request('checkout',{id,payment_method:'cash',amount:0,expected_revision:2})).status,409);assert.equal(h.snap.sheets['Оплаты'].rows.length,0);
});
test('native sale QR routes to the paired cashier as a repair, never as an unknown product or automatic payment',async()=>{
 const h=await harness(),repair=seedRepair(h),p={request_id:randomUUID(),document_id:randomUUID(),kind:'sale',code:repairCode(repair)};
 for(let i=0;i<2;i++){const r=await h.request('scan_unknown',p,'terminal');assert.equal(r.status,200,r.error);assert.equal(r.data.payload.kind,'repair');}
 assert.equal(h.queue.length,1);assert.equal(h.queue[0].station_id,station);assert.equal((await h.request('queue')).data[0].payload.repair_id,repair);assert.equal((await h.request('unknown_scans')).data.length,0);
 assert.equal(h.snap.sheets['Оплаты'].rows.length,0);assert.equal(h.snap.sheets['Ремонты'].rows[0]['Оплачено'],500);
});
test('a previously misclassified repair QR is recovered in place without replacing any receipt or sale',async()=>{
 const h=await harness(),repair=seedRepair(h),p={request_id:randomUUID(),document_id:randomUUID(),kind:'sale',code:repairCode(repair)};
 h.queue.push({id:p.request_id,station_id:station,terminal_id:terminal,state:'queued',payload:{kind:'unknown',code:p.code,document_id:p.document_id,items:[]}});
 assert.equal((await h.request('scan_unknown',p,'terminal')).status,200);assert.equal(h.queue.length,1);assert.equal(h.queue[0].payload.kind,'repair');
 const cancelled=await h.request('scan_unknown',{...p,cancel:true},'terminal');assert.equal(cancelled.data.result.cancelled,true);
 assert.equal((await h.request('scan_unknown',p,'terminal')).data.state,'done');assert.equal((await h.request('queue')).data.length,0);assert.equal(h.receipts.length,0);
});
test('repair QR compatibility retains validation, terminal ownership and processing locks',async()=>{
 const h=await harness(),repair=seedRepair(h),p={request_id:randomUUID(),document_id:randomUUID(),kind:'sale',code:repairCode(repair)};
 assert.equal((await h.request('scan_unknown',{...p,kind:'receipt'},'terminal')).status,400);assert.equal((await h.request('scan_unknown',p)).status,403);
 await h.request('scan_unknown',p,'terminal');h.queue[0].checkout={actor_id:actor};h.queue[0].state='processing';
 assert.equal((await h.request('scan_unknown',{...p,cancel:true},'terminal')).status,409);
 assert.equal((await h.request('scan_unknown',{...p,document_id:randomUUID()},'terminal')).status,409);
 assert.equal((await h.request('scan_unknown',{...p,request_id:randomUUID(),code:'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=bad'},'terminal')).status,400);
 assert.equal(h.snap.sheets['Оплаты'].rows.length,0);
});
const actor=randomUUID(),master=randomUUID(),part=randomUUID(),station=randomUUID(),terminal=randomUUID();
function snapshot(){const schema=JSON.parse(fs.readFileSync(new URL('./google-schema.json',import.meta.url)));schema['Фото товаров']=['photo_id','product_id','category','path','created_at','sha256'];const sheets=Object.fromEntries(Object.entries(schema).map(([k,headers])=>[k,{headers,rows:[]}]));const seed=(name,p)=>sheets[name].rows.push({...Object.fromEntries(sheets[name].headers.map(x=>[x,''])),__row:sheets[name].rows.length+2,...p});seed('Товары',{product_id:part,'Модель / название':'Колодки','Штрих-код':'FGP-00000001','Остаток, шт.':5,'Цена закупки, ₽':100,'Цена продажи, ₽':300,'Активен':true});seed('Сотрудники',{employee_id:master,'ФИО':'Тестовый мастер','Роль':'Механик','Активен':true});return{version:1,sheets};}
test('zero payment atomically removes stock and records master assignment without cash revenue',()=>{const s=snapshot(),r=masterIssue(s,{request_id:randomUUID(),master_id:master,items:[{part_id:part,quantity:2}]},{id:actor,role:'owner'});assert.equal(s.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.equal(r.changes.find(x=>x.sheet==='Товары').values['Остаток, шт.'],3);assert.equal(r.changes.filter(x=>x.sheet==='Продажи'||x.sheet==='Оплаты').length,0);assert.equal(r.result.amount,0);const event=r.changes.find(x=>x.sheet==='События');assert.equal(JSON.parse(event.values['Детали']).master_id,master);assert.equal(r.changes.find(x=>x.sheet==='Движения склада').values['Тип'],'Расход');const sheets=structuredClone(s.sheets);sheets['События'].rows.push(event.values);assert.equal(masterHoldings(sheets)[0].quantity,2);});
test('master issue rejects insufficient stock, inactive/non-master recipient and unprivileged caller',()=>{const p={request_id:randomUUID(),master_id:master,items:[{part_id:part,quantity:9}]};assert.throws(()=>masterIssue(snapshot(),p,{id:actor,role:'owner'}),/Недостаточно/);assert.throws(()=>masterIssue(snapshot(),{...p,master_id:randomUUID()},{id:actor,role:'owner'}),/активного мастера/);assert.throws(()=>masterIssue(snapshot(),p,{id:actor,role:'mechanic'}),/Нет права/);assert.deepEqual(items([{part_id:part,quantity:2},{part_id:part,quantity:1}]),[{part_id:part,quantity:3}]);assert.throws(()=>items([{part_id:part,quantity:-1}]),/количество/);});
async function harness(){let snap=snapshot();const devices=[{id:station,kind:'station',active:true,name:'Склад',token_hash:await digest('station-token')},{id:terminal,kind:'terminal',active:true,station_id:station,token_hash:await digest('terminal-token')}],queue=[],receipts=[],allowed=[{station_id:station}],member={profile_id:actor,role:'owner',name:'Тест',active:true};let lost=false;
const fetcher=async(url,opt={})=>{const u=new URL(url),body=opt.body?JSON.parse(opt.body):null;const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});if(u.pathname==='/auth/v1/user')return respond({id:actor,email:'test@example.invalid'});const path=u.pathname.replace('/rest/v1/','');let list;if(path==='workshop_members')list=[member,{profile_id:master,role:'mechanic',active:true}];else if(path==='workshop_terminal_stations')list=allowed;else if(path==='workshop_warehouse_devices')list=devices;else if(path==='workshop_warehouse_queue')list=queue;else if(path==='workshop_native_receipts')list=receipts;
if(path==='rpc/warehouse_register_terminal_station'){if(allowed.length>=2)return respond({message:'Для ТСД уже разрешены два ноутбука'},409);devices.push({id:body.p_id,name:body.p_name,kind:'station',active:true,token_hash:body.p_token_hash});allowed.push({station_id:body.p_id});return respond({id:body.p_id});}
if(path==='rpc/workshop_native_snapshot')return respond(structuredClone(snap));
if(path==='rpc/workshop_native_commit'){if(member.role==='seller'&&!['stock_receive','sale','shift_open','shift_close','warehouse_repair_payment'].includes(body.p_action))return respond({message:'Нет доступа'},403);const old=receipts.find(x=>x.request_id===body.p_request_id);if(old){assert.equal(old.fingerprint,body.p_fingerprint);return respond({result:old.result});}if(snap.version!==body.p_version)return respond({retry:true});for(const x of body.p_changes){let r=snap.sheets[x.sheet].rows.find(y=>y.__row===x.row);if(!r){r={__row:x.row};snap.sheets[x.sheet].rows.push(r);}Object.assign(r,x.values);}snap.version++;receipts.push({request_id:body.p_request_id,actor_id:body.p_actor,action:body.p_action,fingerprint:body.p_fingerprint,result:body.p_result});return respond({result:body.p_result});}
if(!list)throw Error(path);const matches=r=>[...u.searchParams].every(([k,v])=>{if(['select','limit','order'].includes(k))return true;if(v.startsWith('eq.'))return String(k.includes('->>')?r[k.split('->>')[0]]?.[k.split('->>')[1]]:r[k])===v.slice(3);if(v.startsWith('neq.'))return String(r[k])!==v.slice(4);if(v==='is.null')return r[k]==null;return true;});if(opt.method==='POST'){list.push({active:true,...body,state:body.state||'queued'});return new Response(null,{status:201});}if(opt.method==='PATCH'){if(path==='workshop_warehouse_queue'&&body.state==='done'&&lost){lost=false;throw Error('response lost');}const found=list.filter(matches);found.forEach(x=>Object.assign(x,body));return opt.headers.Prefer?respond(structuredClone(found)):new Response(null,{status:204});}return respond(structuredClone(list.filter(matches)));};
const handler=createHandler({base:'https://test.invalid',key:'test',fetcher});const request=async(action,p={},kind='station')=>{const r=await handler(new Request('https://test.invalid/warehouse',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,device_id:kind==='station'?station:terminal,device_token:kind+'-token',...p})}));return {status:r.status,...await r.json()};};return{allowed,request,queue,receipts,devices,member,get snap(){return snap;},loseCompletion:()=>lost=true};}
test('terminal routes only to paired station, cannot checkout, and retrying one basket never duplicates it',async()=>{const h=await harness(),request_id=randomUUID(),p={request_id,items:[{part_id:part,quantity:1}]};assert.equal((await h.request('enqueue',p,'terminal')).status,200);assert.equal(h.queue[0].station_id,station);assert.equal((await h.request('enqueue',p,'terminal')).status,200);assert.equal(h.queue.length,1);assert.equal((await h.request('checkout',{id:request_id},'terminal')).status,403);assert.equal((await h.request('queue',{},'terminal')).status,403);assert.equal((await h.request('queue',{device_id:randomUUID()})).status,403);});
test('lost completion response retries previously frozen legacy master issue exactly once',async()=>{const h=await harness(),request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:2}]},'terminal');h.queue[0].checkout={actor_id:actor,mode:'master',master_id:master,shift_id:'',payment_method:'',items:[{part_id:part,quantity:2,price_mode:'free',unit_price:0}]};h.queue[0].state='processing';h.loseCompletion();const p={id:request_id,mode:'master',master_id:master,items:[{part_id:part,unit_price:300}]};assert.equal((await h.request('checkout',p)).status,503);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal((await h.request('checkout',p)).status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal(h.receipts.length,1);assert.equal(h.queue[0].state,'done');assert.equal(h.snap.sheets['Продажи'].rows.length,0);});
test('cash sale retries only once and master assignments are owner-only',async()=>{const h=await harness();const opened=await h.request('shift_open',{request_id:randomUUID(),register:'Склад',opening_cash:0});assert.equal(opened.status,200);const request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:1}]},'terminal');const p={id:request_id,mode:'sale',shift_id:opened.data.id,payment_method:'cash',items:[{part_id:part,unit_price:250}]};h.loseCompletion();assert.equal((await h.request('checkout',p)).status,503);assert.equal((await h.request('checkout',p)).status,200);assert.equal(h.snap.sheets['Продажи'].rows.length,1);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],4);h.member.role='seller';assert.equal((await h.request('holdings')).status,403);});
test('unbound master issue is rejected before freezing a basket and revocation stops a paired terminal',async()=>{const h=await harness(),request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:1}]},'terminal');assert.equal((await h.request('checkout',{id:request_id,mode:'master',master_id:randomUUID(),items:[{part_id:part,unit_price:0}]})).status,403);assert.equal(h.queue[0].state,'queued');h.devices[0].active=false;assert.equal((await h.request('catalog',{},'terminal')).status,403);});

test('station registration accepts a real empty PostgREST 201 and returns usable binding',async()=>{const h=await harness();const r=await h.request('register',{name:'Склад тест'});assert.equal(r.status,200);assert.ok(r.data.token);const device=h.devices.find(d=>d.id===r.data.id);assert.equal(device.name,'Склад тест');assert.equal(device.token_hash,await digest(r.data.token));const info=await h.request('info',{device_id:r.data.id,device_token:r.data.token});assert.equal(info.status,200);assert.equal(info.data.device.name,'Склад тест');const code=await h.request('pair_code',{device_id:r.data.id,device_token:r.data.token});assert.equal(code.status,200);assert.ok(code.data.code);});

test('code-free terminal connection requires membership, exposes only station labels and retries once',async()=>{
 const h=await harness(),r=await h.request('stations');assert.equal(r.status,200);assert.equal(r.data.length,1);assert.equal(r.data[0].id,station);assert.equal(r.data[0].token_hash,undefined);
 const p={station_id:station,terminal_id:randomUUID(),token:randomUUID()+randomUUID()};
 const connected=await h.request('connect_terminal',p);assert.equal(connected.status,200);assert.equal(connected.data.station_id,station);assert.equal((await h.request('connect_terminal',p)).status,200);assert.equal(h.devices.filter(x=>x.id===p.terminal_id).length,1);
 const request_id=randomUUID();assert.equal((await h.request('enqueue',{device_id:p.terminal_id,device_token:p.token,request_id,items:[{part_id:part,quantity:1}]})).status,200);assert.equal(h.queue[0].station_id,station);
 assert.equal((await h.request('connect_terminal',{...p,token:randomUUID()+randomUUID()})).status,409);
 assert.equal((await h.request('connect_terminal',{...p,terminal_id:station})).status,409);
 assert.equal((await h.request('connect_terminal',{...p,station_id:terminal})).status,403);
 h.devices[0].active=false;assert.equal((await h.request('connect_terminal',{...p,terminal_id:randomUUID()})).status,404);
 h.member.role='mechanic';assert.equal((await h.request('stations')).status,403);assert.equal((await h.request('connect_terminal',p)).status,403);
});
test('code-free connection never accepts a request without a user session',async()=>{
 const handler=createHandler({base:'https://test.invalid',key:'test',fetcher:async()=>{throw Error('must not reach database');}});
 const r=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'connect_terminal'})}));assert.equal(r.status,401);
});


test('live empty basket reaches its station, revision never rolls back and old checkout cannot charge it',async()=>{
 const h=await harness(),request_id=randomUUID();
 assert.equal((await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[],active:true},'terminal')).status,200);
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
 const empty=randomUUID();await h.request('draft_sync',{request_id:empty,kind:'sale',revision:1,items:[],active:true},'terminal');
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
 assert.equal((await h.request('draft_close',{id:remote})).status,409);
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


test('completed history cannot hide an older active scan document',async()=>{
 const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'receipt',revision:1,items:[{part_id:part,quantity:1}]},'terminal');
 for(let i=0;i<35;i++)h.queue.push({id:randomUUID(),station_id:station,terminal_id:terminal,state:'done',payload:{live:true,kind:'sale',revision:1,items:[]}});
 const result=await h.request('live_jobs');assert.equal(result.status,200);assert.deepEqual(result.data.map(x=>x.id),[id]);
});

test('warehouse pencil sets zero stock with an audited correction and idempotent retry',async()=>{
 const h=await harness(),p={request_id:randomUUID(),part_id:part,field:'quantity',expected:5,value:0};
 const saved=await h.request('inventory_edit',p);assert.equal(saved.status,200,saved.error);assert.equal(saved.data.quantity,0);
 assert.equal((await h.request('inventory_edit',p)).status,200);assert.equal(h.snap.sheets['Движения склада'].rows.length,1);assert.equal(h.snap.sheets['Движения склада'].rows[0]['Тип'],'Корректировка');assert.equal(h.snap.sheets['Движения склада'].rows[0]['Остаток после'],0);
 assert.equal((await h.request('inventory_edit',{...p,request_id:randomUUID(),value:9})).status,409);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],0);
});
test('price pencil changes only retail price and records an audit event',async()=>{
 const h=await harness(),p={request_id:randomUUID(),part_id:part,field:'retail_price',expected:300,value:1250.50};
 const saved=await h.request('inventory_edit',p);assert.equal(saved.status,200,saved.error);assert.equal(saved.data.retail_price,1250.5);
 const row=h.snap.sheets['Товары'].rows[0];assert.equal(row['Остаток, шт.'],5);assert.equal(row['Цена закупки, ₽'],100);assert.equal(row['Штрих-код'],'FGP-00000001');
 assert.equal(h.snap.sheets['События'].rows[0]['Действие'],'price_update');assert.equal((await h.request('inventory_edit',p)).status,200);assert.equal(h.snap.sheets['События'].rows.length,1);
 assert.equal((await h.request('inventory_edit',{...p,value:1300})).status,409);
});
test('inventory edits preserve permissions and reject malformed or stale values before writes',async()=>{
 const h=await harness(),p={request_id:randomUUID(),part_id:part,field:'quantity',expected:5,value:2};
 assert.equal((await h.request('inventory_edit',p,'terminal')).status,403);h.member.role='seller';assert.equal((await h.request('inventory_edit',p)).status,403);h.member.role='owner';
 for(const value of [-1,1.5,'3',null,1000001])assert.equal((await h.request('inventory_edit',{...p,value})).status,400);
 assert.equal((await h.request('inventory_edit',{...p,field:'retail_price',expected:300,value:0.001})).status,400);
 assert.equal((await h.request('inventory_edit',{...p,expected:4})).status,409);assert.equal(h.receipts.length,0);
});

test('warehouse uses auth members for catalog and issue without a duplicate native employee',async()=>{const h=await harness();h.snap.sheets['Сотрудники'].rows=[];const c=await h.request('catalog');assert.equal(c.status,200);assert.equal(c.data.staff[0].profile_id,master);const request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:1}]},'terminal');h.queue[0].checkout={actor_id:actor,mode:'master',master_id:master,shift_id:'',payment_method:'',items:[{part_id:part,quantity:1,price_mode:'free',unit_price:0}]};h.queue[0].state='processing';const result=await h.request('checkout',{id:request_id,mode:'master',master_id:master,items:[{part_id:part,unit_price:0}]});assert.equal(result.status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],4);assert.equal(h.snap.sheets['Сотрудники'].rows.length,0);});
test('warehouse return is atomic, idempotent and owner-only',async()=>{const h=await harness(),request_id=randomUUID();await h.request('enqueue',{request_id,items:[{part_id:part,quantity:2}]},'terminal');h.queue[0].checkout={actor_id:actor,mode:'master',master_id:master,shift_id:'',payment_method:'',items:[{part_id:part,quantity:2,price_mode:'free',unit_price:0}]};h.queue[0].state='processing';await h.request('checkout',{id:request_id,mode:'master',master_id:master,items:[{part_id:part,unit_price:0}]});const p={request_id:randomUUID(),master_id:master,part_id:part,quantity:1};assert.equal((await h.request('master_return',p)).status,200);assert.equal((await h.request('master_return',p)).status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],4);assert.equal((await h.request('holdings')).data[0].quantity,1);h.member.role='seller';assert.equal((await h.request('master_return',{...p,request_id:randomUUID()})).status,403);});

test('native unknown scans are idempotent, station scoped and never enter payment queue',async()=>{
 const h=await harness(),request_id=randomUUID(),document_id=randomUUID(),payload={request_id,document_id,code:'UNKNOWN-65',kind:'receipt'};
 const first=await h.request('scan_unknown',payload,'terminal');assert.equal(first.status,200);assert.equal(first.data.payload.code,'UNKNOWN-65');
 await h.request('scan_unknown',payload,'terminal');assert.equal(h.queue.length,1);
 assert.equal((await h.request('scan_unknown',{...payload,code:'DIFFERENT'},'terminal')).status,409);
 assert.equal((await h.request('scan_unknown',payload)).status,403);
 assert.equal((await h.request('unknown_scans',{},'terminal')).status,403);
 assert.equal((await h.request('unknown_scans')).data.length,1);assert.equal((await h.request('queue')).data.length,0);
 assert.equal(h.receipts.length,0);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],5);
 const repeated={...payload,request_id:randomUUID()};await h.request('scan_unknown',repeated,'terminal');
 const resolved=await h.request('unknown_resolve',{id:request_id,part_id:part});assert.equal(resolved.status,200);assert.equal(resolved.data.part.id,part);
 const replay=await h.request('scan_unknown',payload,'terminal');assert.equal(replay.data.state,'done');assert.equal(replay.data.result.part.id,part);
 assert.equal((await h.request('unknown_scans')).data.length,0);
 assert.equal((await h.request('scan_unknown',repeated,'terminal')).data.result.part.id,part);
 assert.equal((await h.request('scan_unknown',{...payload,request_id:randomUUID()},'terminal')).data.result.part.id,part);
 assert.equal(h.receipts.length,0);
});
test('undo cancels unknown scan without stock changes and terminal cannot resolve it',async()=>{
 const h=await harness(),p={request_id:randomUUID(),document_id:randomUUID(),code:'UNKNOWN-UNDO',kind:'sale'};
 await h.request('scan_unknown',p,'terminal');assert.equal((await h.request('unknown_resolve',{id:p.request_id,part_id:part},'terminal')).status,403);
 const r=await h.request('scan_unknown',{...p,cancel:true},'terminal');assert.equal(r.data.result.cancelled,true);assert.equal(h.receipts.length,0);
 const empty=await h.request('scan_unknown',{...p,request_id:randomUUID(),cancel:true},'terminal');assert.equal(empty.status,200);assert.equal(h.queue.length,1);
});
test('unknown product creation is owner-only, stock remains zero and retry reuses product',async()=>{
 const h=await harness(),p={request_id:randomUUID(),document_id:randomUUID(),code:'NEW-UNKNOWN-PART',kind:'receipt'};await h.request('scan_unknown',p,'terminal');
 h.member.role='seller';assert.equal((await h.request('unknown_resolve',{id:p.request_id,create:{name:'Новая камера',category:'Запчасти',retail_price:400}})).status,403);
 h.member.role='owner';const first=await h.request('unknown_resolve',{id:p.request_id,create:{name:'Новая камера',category:'Запчасти',retail_price:400}});assert.equal(first.status,200,JSON.stringify(first));assert.ok(first.data.part.id);assert.equal(first.data.part.quantity,0);
 const replay=await h.request('unknown_resolve',{id:p.request_id,create:{name:'Новая камера',category:'Запчасти',retail_price:400}});assert.equal(replay.data.part.id,first.data.part.id);assert.equal(h.snap.sheets['Товары'].rows.length,2);
});

test('laptop manual total is exact, freezes across retry and leaves catalog price unchanged',async()=>{
 for(const amount of [0,250.45,750.99]){const h=await harness(),request_id=randomUUID();h.member.role='seller';await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[{part_id:part,quantity:2}]},'terminal');h.loseCompletion();const p={id:request_id,revision:1,payment_method:'cash',total_override:amount};assert.equal((await h.request('live_pay',p)).status,503);const retry=await h.request('live_pay',{...p,total_override:999});assert.equal(retry.status,200,retry.error);assert.equal(retry.data.total,amount);assert.equal(h.snap.sheets['Продажи'].rows.length,1);assert.equal(h.snap.sheets['Продажи'].rows[0]['Итого'],amount);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],3);assert.equal(h.snap.sheets['Товары'].rows[0]['Цена продажи, ₽'],300);assert.match(h.snap.sheets['Продажи'].rows[0]['Комментарий'],/Итого вручную/);}
});
test('manual total rejects malformed values and terminal overrides before stock writes',async()=>{
 const h=await harness(),request_id=randomUUID();await h.request('draft_sync',{request_id,kind:'sale',revision:1,items:[{part_id:part,quantity:1}]},'terminal');const p={id:request_id,revision:1,payment_method:'card'};
 for(const total_override of [-1,0.001,'250',null,100000001]){assert.equal((await h.request('live_pay',{...p,total_override})).status,400);assert.equal(h.queue[0].checkout,undefined);}
 assert.equal((await h.request('live_pay',{...p,total_override:200},'terminal')).status,403);assert.equal(h.receipts.length,0);assert.equal((await h.request('live_pay',p)).data.total,300);
});
test('receipt can omit removed scanned goods, but cannot add unscanned goods or receive an empty list',async()=>{const h=await harness(),request_id=randomUUID(),extra=randomUUID();h.snap.sheets['Товары'].rows.push({...h.snap.sheets['Товары'].rows[0],__row:3,product_id:extra,'Остаток, шт.':0});await h.request('draft_sync',{request_id,kind:'receipt',revision:1,items:[{part_id:part,quantity:2},{part_id:extra,quantity:1}]},'terminal');assert.equal((await h.request('live_receive',{id:request_id,revision:1,items:[]})).status,400);assert.equal((await h.request('live_receive',{id:request_id,revision:1,items:[{part_id:randomUUID(),quantity:1}]})).status,409);const p={id:request_id,revision:1,items:[{part_id:part,quantity:3}]};assert.equal((await h.request('live_receive',p)).status,200);assert.equal((await h.request('live_receive',p)).status,200);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],8);assert.equal(h.snap.sheets['Товары'].rows[1]['Остаток, шт.'],0);});

test('terminal station allowlist hides old stations and denies revoked tokens before a document write',async()=>{const h=await harness();const other={...h.devices[0],id:randomUUID(),name:'Старый ноутбук'};h.devices.push(other);const list=await h.request('stations');assert.equal(list.data.length,1);assert.equal((await h.request('connect_terminal',{station_id:other.id,terminal_id:randomUUID(),token:randomUUID()+randomUUID()})).status,403);h.allowed.length=0;assert.equal((await h.request('catalog',{},'terminal')).status,403);assert.equal((await h.request('draft_sync',{request_id:randomUUID(),kind:'receipt',revision:1,items:[]},'terminal')).status,403);assert.equal(h.queue.length,0);});
test('only owner can enroll second laptop and third enrollment cannot bypass the slot limit',async()=>{const h=await harness();h.member.role='seller';assert.equal((await h.request('register',{name:'Чужой'})).status,403);h.member.role='owner';assert.equal((await h.request('register',{name:'Этот ноутбук'})).status,200);assert.equal((await h.request('register',{name:'Третий ноутбук'})).status,409);assert.equal(h.allowed.length,2);});

test('station can cancel a terminal receipt before confirmation, retry once, and late scans cannot revive it',async()=>{const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'receipt',revision:2,items:[{part_id:part,quantity:3}]},'terminal');const before=h.snap.sheets['Товары'].rows[0]['Остаток, шт.'];const result=await h.request('draft_close',{id,revision:2});assert.equal(result.status,200);assert.equal(result.data.result.cancelled,true);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],before);assert.equal(h.receipts.length,0);assert.equal((await h.request('draft_close',{id,revision:2})).status,200);assert.equal((await h.request('job',{id},'terminal')).data.state,'done');assert.equal((await h.request('draft_sync',{request_id:id,kind:'receipt',revision:3,items:[{part_id:part,quantity:4}]},'terminal')).status,409);assert.equal((await h.request('live_receive',{id,revision:2})).data.cancelled,true);assert.equal(h.receipts.length,0);});
test('receipt cancellation rejects a stale revision, another terminal, and frozen checkout',async()=>{const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'receipt',revision:2,items:[{part_id:part,quantity:2}]},'terminal');assert.equal((await h.request('draft_close',{id,revision:1})).status,409);const other=randomUUID();h.devices.push({id:other,kind:'terminal',station_id:station,active:true,token_hash:await digest('other-cancel')});assert.equal((await h.request('draft_close',{id,revision:2,device_id:other,device_token:'other-cancel'},'terminal')).status,403);h.member.role='manager';h.member.can_sell=true;assert.equal((await h.request('draft_close',{id,revision:2})).status,403);h.member.role='seller';h.loseCompletion();assert.equal((await h.request('live_receive',{id,revision:2})).status,503);assert.equal((await h.request('draft_close',{id,revision:2})).status,409);assert.equal((await h.request('live_receive',{id,revision:2})).status,200);assert.equal(h.receipts.length,1);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],7);});
test('cash laptop cancels a terminal sale or repair once, leaving stock, price and payments unchanged',async()=>{
 for(const kind of ['sale','repair']){const h=await harness(),id=randomUUID(),repair=seedRepair(h);if(kind==='sale')await h.request('draft_sync',{request_id:id,kind,revision:2,items:[{part_id:part,quantity:2}]},'terminal');else await h.request('enqueue_repair',{request_id:id,repair_id:repair},'terminal');
  const p={id,kind,revision:kind==='sale'?2:1};const cancelled=await h.request('cancel_document',p);assert.equal(cancelled.status,200,cancelled.error);assert.equal(cancelled.data.result.cancelled,true);assert.equal((await h.request('cancel_document',p)).status,200);assert.equal((await h.request('job',{id},'terminal')).data.result.cancelled,true);assert.equal(h.receipts.length,0);assert.equal(h.snap.sheets['Оплаты'].rows.length,0);assert.equal(h.snap.sheets['Товары'].rows[0]['Остаток, шт.'],5);assert.equal(h.snap.sheets['Ремонты'].rows[0]['Итого'],1500);assert.equal(h.snap.sheets['Ремонты'].rows[0]['Оплачено'],500);
 }
});
test('laptop cancellation refuses stale or forged revisions, processing and a different station',async()=>{
 const h=await harness(),id=randomUUID();await h.request('draft_sync',{request_id:id,kind:'sale',revision:2,items:[{part_id:part,quantity:1}]},'terminal');
 for(const revision of [1,3])assert.equal((await h.request('cancel_document',{id,kind:'sale',revision})).status,409);assert.equal(h.queue[0].state,'queued');h.queue[0].checkout={actor_id:actor};h.queue[0].state='processing';assert.equal((await h.request('cancel_document',{id,kind:'sale',revision:2})).status,409);
 const other=randomUUID();h.devices.push({id:other,kind:'station',active:true,token_hash:await digest('other-station')});h.allowed.push({station_id:other});assert.equal((await h.request('cancel_document',{id,kind:'sale',revision:2,device_id:other,device_token:'other-station'})).status,404);assert.equal(h.queue.length,1);assert.equal(h.receipts.length,0);
});
test('a new terminal scan racing laptop cancellation keeps the updated draft instead of cancelling a stale snapshot',async()=>{
 const id=randomUUID(),stationId=randomUUID(),job={id,state:'queued',checkout:null,payload:{live:true,kind:'sale',revision:2,items:[]}};let cancelled=false;
 const db=async(_table,query,method)=>{if(method==='PATCH'){job.payload.revision=3;if(query.includes('payload->>revision=eq.2'))return [];cancelled=true;return [{...job,state:'done'}];}return [structuredClone(job)];};
 await assert.rejects(()=>cancelDocument('cancel_document',{id,kind:'sale',revision:2},{db,actor:{id:actor},device:{id:stationId,kind:'station'},stationId}),e=>e.status===409);assert.equal(cancelled,false);assert.equal(job.state,'queued');assert.equal(job.payload.revision,3);
});
