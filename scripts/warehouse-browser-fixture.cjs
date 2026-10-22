// Shared browser fixture. Database concurrency/idempotency is covered by warehouse.test.mjs.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const actor='11111111-1111-4111-8111-111111111111',part='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333';
const catalog=[{id:part,name:'Покрышка 10 × 2,5',barcode:'FGP-00000001',retail_price:1200,quantity:20,active:true},{id:second,name:'Камера 10 × 2,5',barcode:'FGP-00000002',retail_price:300,quantity:20,active:true}];
const launchOptions={headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{})};
async function serve(){const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {server,base:'http://127.0.0.1:'+server.address().port};}
function backend(){const jobs=new Map(),payments=[],quote={id:'66666666-6666-4666-8666-666666666666',number:'0026',vehicle:'Kugoo M4 Pro',total:1500,paid:500,due:1000,revision:2,payable:true};const state={offline:false,holdPayment:false,repairPaid:false,role:'owner',failEditResponse:false,holdings:[],returns:[],failReturnResponse:false,returnReceipts:new Map(),edits:[],editReceipts:new Map(),parts:structuredClone(catalog).map((x,i)=>({...x,sku:i?'FGP-038':'FGP-037'}))};
 async function connect(c,terminal){await c.addInitScript(({actor})=>{localStorage.setItem('fastgo_warehouse_session_v1',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800}));for(const kind of ['terminal','station'])localStorage.setItem('fgwarehouse:'+actor+':'+kind,JSON.stringify({id:'55555555-5555-4555-8555-555555555555',token:'test',name:'Склад'}));},{actor});
 await c.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{if(terminal&&state.offline)return route.abort();const p=route.request().postDataJSON()||{};let data,error,status=200;
 switch(p.action){
 case 'info':data={device:{name:'Склад',kind:terminal?'terminal':'station'},member:{role:state.role}};break;
 case 'catalog':data={parts:state.parts,staff:[]};break;
 case 'holdings':data=state.holdings.filter(x=>x.quantity>0);break;
 case 'master_return':{state.returns.push(p);const old=state.returnReceipts.get(p.request_id);if(old){data=old;break;}const x=state.holdings.find(x=>x.master_id===p.master_id&&x.part_id===p.part_id);if(!x||x.quantity<p.quantity){status=409;error='Недостаточно на мастере';break;}x.quantity-=p.quantity;data={ok:true};state.returnReceipts.set(p.request_id,data);if(state.failReturnResponse){state.failReturnResponse=false;return route.abort();}break;}
 case 'inventory_edit':{state.edits.push(p);const old=state.editReceipts.get(p.request_id);if(old){data=old;break;}const x=state.parts.find(x=>x.id===p.part_id);if(x[p.field]!==p.expected){status=409;error='Данные изменились';break;}x[p.field]=p.value;data=structuredClone(x);state.editReceipts.set(p.request_id,data);if(state.failEditResponse){state.failEditResponse=false;return route.abort();}break;}
 case 'queue':data=[...jobs.values()].filter(j=>j.payload.kind==='repair'&&j.state!=='done');break;
 case 'unknown_scans':data=[...jobs.values()].filter(j=>j.payload.kind==='unknown'&&j.state!=='done');break;
 case 'unknown_resolve':{const j=jobs.get(p.id);j.state='done';j.result={part:catalog.find(x=>x.id===p.part_id)};data=j.result;break;}
 case 'live_jobs':data=[...jobs.values()].filter(j=>j.payload.live).reverse();break;
 case 'repair_quote':data=quote;break;
 case 'enqueue_repair':data=jobs.get(p.request_id)||{id:p.request_id,state:'queued',repair:quote,payload:{kind:'repair',repair_id:quote.id,repair:quote,items:[]}};jobs.set(data.id,data);break;
 case 'checkout':{const j=jobs.get(p.id);if(j.state!=='done'){payments.push(p);j.state='done';j.result={amount:1000};state.repairPaid=true;}data=j.result;break;}
 case 'draft_sync':{let j=jobs.get(p.request_id);if(j&&j.state!=='queued'){status=409;error='Документ уже проводится или завершён';break;}if(!j||j.payload.revision<p.revision){j={id:p.request_id,state:'queued',payload:{live:true,...p,updated_at:new Date().toISOString()}};jobs.set(j.id,j);}data=j;break;}
 case 'job':data=jobs.get(p.id)||null;break;
 case 'live_pay':case 'live_receive':{const j=jobs.get(p.id);if(j.state==='done'){data=j.result;break;}if(!j.checkout&&p.revision!==j.payload.revision){status=409;error='Корзина изменилась';break;}j.checkout||={payment_method:p.payment_method,items:p.items||structuredClone(j.payload.items)};if(state.holdPayment){state.holdPayment=false;j.state='processing';return route.abort();}j.state='done';j.result={total:0,payment_method:j.checkout.payment_method};payments.push({...p,items:structuredClone(j.checkout.items)});data=j.result;break;}
 case 'draft_close':data=jobs.get(p.id);if(data.state!=='done'&&(data.state!=='queued'||data.checkout||p.revision!==undefined&&p.revision!==data.payload.revision)){status=409;error='Приход изменился или проводится';break;}data.state='done';data.result={cancelled:true};break;
 default:if(route.request().method()!=='OPTIONS')throw Error('Unexpected browser API action: '+p.action);
 }
 await route.fulfill({status,json:{data,error},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});});}
 return {connect,jobs,payments,quote,state};
}
async function scan(page,code='FGP-00000001',suffix='Enter'){await page.keyboard.type(code,{delay:5});if(suffix)await page.keyboard.press(suffix);}
module.exports={actor,part,second,catalog,launchOptions,serve,backend,scan};
