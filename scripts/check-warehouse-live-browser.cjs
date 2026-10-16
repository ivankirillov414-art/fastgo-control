const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),actor='11111111-1111-4111-8111-111111111111',part='22222222-2222-4222-8222-222222222222';
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
 const jobs=new Map(),payments=[];let offline=false,holdPayment=false;
 async function context(terminal){const c=await browser.newContext({viewport:terminal?{width:320,height:480}:{width:1280,height:800}});
 await c.addInitScript(({actor})=>{localStorage.setItem('fastgo_warehouse_session_v1',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800}));for(const kind of ['terminal','station'])localStorage.setItem('fgwarehouse:'+actor+':'+kind,JSON.stringify({id:'55555555-5555-4555-8555-555555555555',token:'test',name:'Склад'}));},{actor});
 await c.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{if(terminal&&offline)return route.abort();const p=route.request().postDataJSON()||{};let data;
 if(p.action==='info')data={device:{name:'Склад',kind:terminal?'terminal':'station'},member:{role:'owner'}};
 if(p.action==='catalog')data={parts:[{id:part,name:'Подшипник 6001',barcode:'FGP-00000001',retail_price:300,quantity:20,active:true}],staff:[]};
 if(p.action==='queue')data=[];
 if(p.action==='live_jobs')data=[...jobs.values()].reverse();
 if(p.action==='draft_sync'){let j=jobs.get(p.request_id);if(!j||j.payload.revision<p.revision){j={id:p.request_id,state:'queued',payload:{live:true,...p,updated_at:new Date().toISOString()}};jobs.set(j.id,j);}data=j;}
 if(p.action==='job')data=jobs.get(p.id)||null;
 if(p.action==='live_pay'||p.action==='live_receive'){const j=jobs.get(p.id);assert.equal(p.revision,j.payload.revision);if(holdPayment){holdPayment=false;j.state='processing';j.checkout={payment_method:p.payment_method};return route.abort();}j.state='done';j.result={total:j.payload.items.reduce((sum,x)=>sum+x.quantity*(x.custom_price?x.unit_price:300),0),payment_method:p.payment_method};payments.push({...p,items:structuredClone(j.payload.items)});data=j.result;}
 if(p.action==='draft_close'){data=jobs.get(p.id);data.state='done';data.result={cancelled:true};}
 await route.fulfill({json:{data},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});});return c;}
 const tc=await context(true),dc=await context(false),t=await tc.newPage(),d=await dc.newPage(),base='http://127.0.0.1:'+server.address().port;
 const errors=[];t.on('pageerror',e=>errors.push(e.message));d.on('pageerror',e=>errors.push(e.message));
 await Promise.all([t.goto(base+'/warehouse-terminal.html'),d.goto(base+'/warehouse.html')]);await t.locator('#pay').waitFor();
 assert.equal(await t.locator('#resume,#back').count(),0);assert.equal(await t.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
 await t.locator('#receipt').click();await t.locator('.scan-empty').waitFor();await d.getByText('Ожидаем сканирование на ТСД…').waitFor();assert.equal(await t.locator('.scan-product').count(),0);
 await t.keyboard.type('FGP-00000001',{delay:5});await t.locator('.scan-product').waitFor();await d.locator('#live-terminal-panel .scan-product').waitFor();assert.match(await d.locator('#live-terminal-panel').innerText(),/Подшипник 6001/);
 assert.equal(await t.locator('#live-payment').isVisible(),false);await d.locator('#mirror-submit').click();await t.locator('#pay').waitFor();assert.equal(payments[0].action,'live_receive');
 for(const method of ['cash','card','transfer']){
  await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();await t.keyboard.type('FGP-00000001',{delay:5});await t.keyboard.press('Enter');await t.locator('[data-live-qty]').waitFor();assert.equal(await t.locator('[data-live-qty]').inputValue(),'1');
  assert.equal(await t.locator('[data-own-value]').isVisible(),false);assert.match(await t.locator('#live-total').innerText(),/300/);
  await t.locator('[data-own]').check();await t.locator('[data-own-value]').fill('250.50');await t.locator('input[name="live-method"][value="'+method+'"]').check();await t.locator('#live-submit').click();await t.locator('#pay').waitFor();
  const payment=payments.at(-1);assert.equal(payment.payment_method,method);assert.equal(payment.items[0].unit_price,250.5);assert.equal(payment.items[0].quantity,1);
 }
 // A lost payment response freezes edits and retry completes the original basket.
 await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();await t.keyboard.type('FGP-00000001',{delay:5});await t.locator('[data-live-qty]').waitFor();await t.locator('input[value="card"]').check();holdPayment=true;await t.locator('#live-submit').click();await t.waitForFunction(()=>document.querySelector('[data-live-qty]')?.disabled===true);await t.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(payments.at(-1).payment_method,'card');
 // New operation is empty; offline scans survive reload and reach the laptop after reconnect.
 await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();offline=true;await t.keyboard.type('FGP-00000001',{delay:5});await t.locator('[data-live-qty]').waitFor();await t.locator('#live-back').click();await t.reload();await t.locator('#pay').click();assert.equal(await t.locator('[data-live-qty]').inputValue(),'1');
 offline=false;await t.locator('input[value="cash"]').check();await t.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(payments.at(-1).items[0].quantity,1);assert.equal(payments.at(-1).items[0].custom_price,undefined);
 assert.equal(await t.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS: empty receipt/sale, automatic laptop mirroring, hardware scan, receipt on laptop, catalog/custom price, all three payment methods, offline resume, compact 320x480 home');
 await tc.close();await dc.close();
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
