// Shared browser fixture. Database concurrency/idempotency is covered by warehouse.test.mjs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const actor='11111111-1111-4111-8111-111111111111',part='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333';
const catalog=[{id:part,name:'Покрышка 10 × 2,5',barcode:'FGP-00000001',retail_price:1200,unit_cost:600,quantity:20,active:true},{id:second,name:'Камера 10 × 2,5',barcode:'FGP-00000002',retail_price:300,unit_cost:120,quantity:20,active:true}];
const launchOptions={headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{})};
async function serve(){const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,base:'http://127.0.0.1:'+server.address().port};}
function backend(){const jobs=new Map(),payments=[],quote={id:'66666666-6666-4666-8666-666666666666',number:'0026',vehicle:'Kugoo M4 Pro',total:1500,paid:500,due:1000,revision:2,payable:true};const state={offline:false,holdPayment:false,repairPaid:false,role:'owner',failEditResponse:false,holdings:[],returns:[],failReturnResponse:false,returnReceipts:new Map(),edits:[],editReceipts:new Map(),partPhotos:new Map(),photoUploads:[],photoReceipts:new Map(),productSaves:[],productReceipts:new Map(),stockIntakes:[],stockReceipts:new Map(),failPhotoResponse:false,imageRequests:0,expirePhotoOnce:false,parts:structuredClone(catalog).map((x,i)=>({...x,sku:i?'FGP-038':'FGP-037'}))};
 async function connect(c,terminal,options={}){await c.addInitScript(({actor,options})=>{localStorage.setItem('fastgo_warehouse_session_v1',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800}));if(options.unified)localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800}));for(const kind of (options.readonly?[]:['terminal','station']))localStorage.setItem('fgwarehouse:'+actor+':'+kind,JSON.stringify({id:'55555555-5555-4555-8555-555555555555',token:'test',name:'Склад'}));},{actor,options});
 await c.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{if(terminal&&state.offline)return route.abort();if(route.request().url().includes('/storage/')){state.imageRequests++;return route.fulfill((route.request().url().includes('expired=1')||state.expirePhotoOnce&&(state.expirePhotoOnce=false,true))?{status:403,body:'expired'}:{status:200,body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),contentType:'image/png'});}const envelope=route.request().postDataJSON()||{};const p=route.request().url().includes('fastgo-workshop-api')?{...envelope.params,action:envelope.action}:envelope;let data,error,status=200;
 if(route.request().url().includes('/functions/v1/fastgo-avito'))return route.fulfill({json:{data:{connected:false,owner:state.role==='owner',notifications:[],popups_allowed:false}},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
 switch(p.action){
 case 'request_access':data={active:true};break;
 case 'me':data={profile_id:actor,role:state.role,name:'Тест'};break;
 case 'part_photos':data=state.partPhotos.get(p.part_id)||[];break;
 case 'part_photo_url':data={url:'https://oqgpjfikjpcplnxueoki.supabase.co/storage/v1/object/sign/test/'+p.part_id+'?v='+Math.random()};break;
 case 'part_photo_upload':{state.photoUploads.push(p);if(state.photoReceipts.has(p.request_id)){data=state.photoReceipts.get(p.request_id);break;}const item=state.parts.find(x=>x.id===p.part_id),photos=state.partPhotos.get(p.part_id)||[];photos.forEach(x=>x.primary=false);data={path:'native:products/'+p.part_id+'/'+p.request_id};photos.push({id:p.request_id,path:data.path,primary:true});state.partPhotos.set(p.part_id,photos);item.primary_photo_path=data.path;state.photoReceipts.set(p.request_id,data);if(state.failPhotoResponse){state.failPhotoResponse=false;return route.abort();}break;}
 case 'part_photo_primary':{const photos=state.partPhotos.get(p.part_id)||[];photos.forEach(x=>x.primary=x.id===p.photo_id);data={path:photos.find(x=>x.primary).path};state.parts.find(x=>x.id===p.part_id).primary_photo_path=data.path;break;}
 case 'part_save':{state.productSaves.push(p);if(state.productReceipts.has(p.request_id)){data=state.productReceipts.get(p.request_id);break;}data={...p,id:'88888888-8888-4888-8888-'+String(state.parts.length).padStart(12,'0'),barcode:'FGP-'+String(state.parts.length+1).padStart(8,'0'),quantity:0,active:true};state.parts.push(data);state.productReceipts.set(p.request_id,structuredClone(data));break;}
 case 'stock':{state.stockIntakes.push(p);if(state.stockReceipts.has(p.request_id)){data=state.stockReceipts.get(p.request_id);break;}const item=state.parts.find(x=>x.id===p.part_id);item.quantity+=p.quantity;data={ok:true};state.stockReceipts.set(p.request_id,data);break;}
 case 'info':data={device:{name:'Склад',kind:terminal?'terminal':'station'},member:{role:state.role}};break;
 case 'device_status':data={version:p.version,last_seen:new Date().toISOString()};break;
 case 'catalog':data={parts:state.parts,staff:[],categories:[],services:[],capabilities:{private_product_photos:true}};break;
 case 'holdings':data=state.holdings.filter(x=>x.quantity>0);break;
 case 'master_return':{state.returns.push(p);const old=state.returnReceipts.get(p.request_id);if(old){data=old;break;}const x=state.holdings.find(x=>x.master_id===p.master_id&&x.part_id===p.part_id);if(!x||x.quantity<p.quantity){status=409;error='Недостаточно на мастере';break;}x.quantity-=p.quantity;data={ok:true};state.returnReceipts.set(p.request_id,data);if(state.failReturnResponse){state.failReturnResponse=false;return route.abort();}break;}
 case 'inventory_edit':{state.edits.push(p);const old=state.editReceipts.get(p.request_id);if(old){data=old;break;}const x=state.parts.find(x=>x.id===p.part_id);if(x[p.field]!==p.expected){status=409;error='Данные изменились';break;}x[p.field]=p.value;data=structuredClone(x);state.editReceipts.set(p.request_id,data);if(state.failEditResponse){state.failEditResponse=false;return route.abort();}break;}
 case 'queue':data=[...jobs.values()].filter(j=>['repair','sale'].includes(j.payload.kind)&&!j.payload.live&&j.state!=='done');break;
 case 'receipt_label_jobs':data=[...jobs.values()].filter(j=>j.state==='done'&&j.result?.label_print_status==='pending');break;
 case 'receipt_label_ack':jobs.get(p.id).result.label_print_status='printed';data={printed:true};break;
 case 'cash_state':data={shifts:[]};break;
 case 'unknown_scans':data=[...jobs.values()].filter(j=>j.payload.kind==='unknown'&&j.state!=='done');break;
 case 'unknown_cancel':{const j=jobs.get(p.id);if(j.state!=='done'){if(j.state!=='queued'||j.checkout){status=409;error='Позиция создаётся';break;}j.state='done';j.result={cancelled:true};}data=j.result;if(state.failCancelResponse){state.failCancelResponse=false;return route.abort();}break;}
 case 'unknown_resolve':{const j=jobs.get(p.id);j.state='done';j.result={part:catalog.find(x=>x.id===p.part_id)};data=j.result;break;}
 case 'live_jobs':data=[...jobs.values()].filter(j=>j.payload.live).reverse();break;
 case 'repair_quote':data=quote;break;
 case 'enqueue_repair':data=jobs.get(p.request_id)||{id:p.request_id,state:'queued',repair:quote,payload:{kind:'repair',repair_id:quote.id,repair:quote,items:[]}};jobs.set(data.id,data);break;
 case 'checkout':{const j=jobs.get(p.id);if(j.state!=='done'){payments.push(p);j.state='done';j.result={amount:1000};state.repairPaid=true;}data=j.result;break;}
 case 'draft_sync':{let j=jobs.get(p.request_id);if(j&&j.state!=='queued'){status=409;error='Документ уже проводится или завершён';break;}if(!j||j.payload.revision<p.revision){j={id:p.request_id,state:'queued',payload:{live:true,...p,updated_at:new Date().toISOString()}};jobs.set(j.id,j);}data=j;break;}
 case 'job':data=jobs.get(p.id)||null;break;
 case 'live_pay':case 'live_receive':{const j=jobs.get(p.id);if(j.state==='done'){data=j.result;break;}if(!j.checkout&&p.revision!==j.payload.revision){status=409;error='Корзина изменилась';break;}j.checkout||={payment_method:p.payment_method,total_override:p.total_override,items:p.items||structuredClone(j.payload.items)};if(state.holdPayment){state.holdPayment=false;j.state='processing';return route.abort();}j.state='done';j.result={total:0,payment_method:j.checkout.payment_method,...(p.action==='live_receive'?{label_print_status:'pending',items:j.checkout.items.map(x=>({...state.parts.find(y=>y.id===x.part_id),quantity:x.quantity}))}:{})};payments.push({...p,total_override:j.checkout.total_override,items:structuredClone(j.checkout.items)});data=j.result;break;}
 case 'cancel_document':{data=jobs.get(p.id);if(!data){status=404;error='Документ не найден';break;}if(data.state==='done')break;if(data.state!=='queued'||data.checkout||data.payload.live&&data.payload.revision!==p.revision){status=409;error='Документ изменился или проводится';break;}data.state='done';data.result={cancelled:true};if(state.failCancelResponse){state.failCancelResponse=false;return route.abort();}break;}
 case 'draft_close':data=jobs.get(p.id);if(data.state!=='done'&&(data.state!=='queued'||data.checkout||p.revision!==undefined&&p.revision!==data.payload.revision)){status=409;error='Приход изменился или проводится';break;}data.state='done';data.result={cancelled:true};break;
 default:if(route.request().method()!=='OPTIONS')throw Error('Unexpected browser API action: '+p.action);
 }
 await route.fulfill({status,json:{data,error},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});});}
 return {connect,jobs,payments,quote,state};
}
async function scan(page,code='FGP-00000001',suffix='Enter'){
 await page.bringToFront();
 // Receipts on a laptop now receive TSD/USB scans only. ATOL is for payment
 // or repair-parts issue; route receipt fixtures through the real USB inbox.
 if(await page.locator('body[data-mode=station] #live-submit').count()&&(await page.locator('#live-submit').innerText())==='Оформить приход'){
  const id=await page.evaluate(code=>{const id=crypto.randomUUID();window.__testInbox??=[];window.__testAcknowledged??=[];window.warehouseDesktop={...window.warehouseDesktop,usbInbox:async()=>({items:window.__testInbox}),usbResult:async(id,result)=>{window.__testAcknowledged.push({id,result});window.__testInbox=window.__testInbox.filter(x=>x.id!==id);}};window.__testInbox.push({id,kind:'receipt',code});return id;},code);
  await page.waitForFunction(id=>window.__testAcknowledged.some(x=>x.id===id),id);return;
 }
 await page.keyboard.type(code,{delay:5});if(suffix)await page.keyboard.press(suffix);
}
module.exports={actor,part,second,catalog,launchOptions,serve,backend,scan};
