const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),actor='11111111-1111-4111-8111-111111111111',part='22222222-2222-4222-8222-222222222222',master='33333333-3333-4333-8333-333333333333',jobid='44444444-4444-4444-8444-444444444444';
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']}: {})});try{let sent,paid;const context=await browser.newContext({viewport:{width:320,height:480}});await context.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{const req=route.request(),p=req.postDataJSON()||{};let result;if(req.url().includes('/auth/'))result={access_token:'test',refresh_token:'test',expires_in:3600,user:{id:actor}};else{let data;if(p.action==='info')data={device:{name:'Тест',kind:'station'},member:{role:'owner'}};if(p.action==='catalog')data={parts:[{id:part,name:'Колодки',barcode:'FGP-00000001',retail_price:300,quantity:5,active:true}],staff:[{profile_id:master,name:'Мастер',role:'mechanic',active:true}]};if(p.action==='enqueue'){sent=p;data={id:jobid,state:'queued'};}if(p.action==='queue')data=[{id:jobid,payload:{items:[{part_id:part,quantity:2}]},state:'queued',created_at:new Date().toISOString()}];if(p.action==='job')data={id:jobid,payload:{items:[{part_id:part,quantity:2}]},state:'queued'};if(p.action==='cash_state')data={shifts:[{id:jobid,status:'open',register:'Склад',number:1}]};if(p.action==='checkout'){paid=p;data={id:jobid};}result={data};}await route.fulfill({json:result,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});});
await context.addInitScript(({actor})=>{localStorage.setItem('fastgo_warehouse_session_v1',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800}));for(const kind of ['terminal','station'])localStorage.setItem('fgwarehouse:'+actor+':'+kind,JSON.stringify({id:'55555555-5555-4555-8555-555555555555',token:'test',name:'Склад'}));},{actor});
const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/warehouse-terminal.html');await page.getByRole('heading',{name:'Складской терминал'}).waitFor();assert.equal(await page.locator('#setup,#rebind,#pair-code,#login').count(),0);assert.equal(await page.locator('#back,#resume').count(),0);assert.equal(await page.locator('#logout').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);await page.locator('summary').filter({hasText:'Подключение по USB'}).waitFor();await page.locator('#pay').click();
assert.equal(await page.locator('#barcode').evaluate(el=>el===document.activeElement),true);
// A scanner without an Enter suffix adds once after the complete fast burst.
await page.keyboard.type('FGP-00000001',{delay:5});
await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='1');
await page.keyboard.type('FGP-00000001',{delay:5});await page.keyboard.press('Enter');
await page.waitForTimeout(250);assert.equal(await page.locator('[data-qty]').inputValue(),'2');
await page.keyboard.type('FGP-00000001',{delay:5});await page.keyboard.press('Tab');
await page.waitForTimeout(250);assert.equal(await page.locator('[data-qty]').inputValue(),'3');
// No field tap is required after focus moved to the page or a button.
await page.locator('#back').focus();await page.keyboard.type('FGP-00000001',{delay:5});
await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='4');
// Slow manual entry still requires explicit Add / Enter.
await page.keyboard.type('FGP-00000001',{delay:90});await page.waitForTimeout(250);
assert.equal(await page.locator('[data-qty]').inputValue(),'4');await page.keyboard.press('Enter');
assert.equal(await page.locator('[data-qty]').inputValue(),'5');
await page.locator('[data-qty]').fill('2');await page.locator('[data-qty]').press('Tab');
assert.equal(await page.locator('#barcode').inputValue(),'');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('#send').click();await page.getByRole('heading',{name:'Передано на ноутбук'}).waitFor();assert.equal(sent.items[0].quantity,2);
// Receipt notes/quantities must not be interpreted as scans.
await page.locator('#sent-back').click();await page.locator('#receipt').click();
assert.equal(await page.locator('#barcode').evaluate(el=>el===document.activeElement),true);
await page.locator('#note').focus();await page.keyboard.type('FGP-00000001',{delay:5});await page.keyboard.press('Enter');
assert.equal(await page.locator('[data-qty]').count(),0);assert.equal(await page.locator('#note').inputValue(),'FGP-00000001');
await page.locator('#barcode').focus();await page.keyboard.type('UNKNOWN-CODE',{delay:5});
await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Код не найден'));
await page.keyboard.type('FGP-00000001',{delay:5});await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='1');
await page.locator('[data-remove]').click();assert.equal(await page.locator('#barcode').evaluate(el=>el===document.activeElement),true);
// Batched scanner insertion (Android input connection) also works.
await page.locator('#barcode').fill('FGP-00000001');await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='1');
await page.evaluate(()=>{const input=document.getElementById('barcode');input.value='FGP-00000001';input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('back').click();});await page.waitForTimeout(250);
await page.locator('#receipt').click();assert.equal(await page.locator('[data-qty]').inputValue(),'1');
assert.equal(await page.locator('#note').inputValue(),'FGP-00000001');
page.once('dialog',d=>d.accept());await page.locator('#discard').click();
await page.setViewportSize({width:1280,height:800});await page.goto('http://127.0.0.1:'+server.address().port+'/warehouse.html');await page.locator('#terminal-update').click();await page.locator('#terminal-help[open]').waitFor();await page.getByRole('button',{name:'Понятно',exact:true}).click();await page.evaluate(()=>{window.openedUpdater=0;window.warehouseDesktop={openTerminalUpdater:async()=>{window.openedUpdater++;}};});await page.locator('#terminal-update').click();assert.equal(await page.evaluate(()=>window.openedUpdater),1);assert.equal(await page.locator('#terminal-help').evaluate(el=>el.open),false);await page.locator('[data-job]').click();await page.locator('#mode').selectOption('master');assert.match(await page.locator('#total').innerText(),/0/);await page.locator('#checkout').click();await page.locator('#pay').waitFor();assert.equal(paid.master_id,master);assert.equal(paid.mode,'master');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);// A USB delivery acknowledged late must never increment a persisted draft twice.
await page.evaluate(()=>{
 window.usbPending=[{id:'usb-test-item-001',code:'FGP-00000001'}];window.usbFailAck=true;
 Object.assign(window.warehouseDesktop,{
 usbTarget:async t=>{window.usbTarget=t;},
 usbBatch:async()=>({items:window.usbPending,unassigned:0}),
 usbAck:async(_key,ids)=>{if(window.usbFailAck){window.usbFailAck=false;throw Error('Lost acknowledgement');}window.usbPending=window.usbPending.filter(x=>!ids.includes(x.id));},
 usbRelease:async()=>{window.usbTarget=null;}
 });
});
await page.locator('#receipt').click();await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='1');
await page.waitForFunction(()=>window.usbPending.length===0);assert.equal(await page.locator('[data-qty]').inputValue(),'1');
await page.locator('#note').fill('Supplier');await page.evaluate(()=>window.usbPending.push({id:'usb-test-item-002',code:'FGP-00000001'}));
await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='2');assert.equal(await page.locator('#note').inputValue(),'Supplier');
assert.equal(await page.locator('#note').evaluate(el=>el===document.activeElement),true);
await page.locator('[data-qty]').focus();await page.evaluate(()=>window.usbPending.push({id:'usb-test-item-003',code:'FGP-00000001'}));await page.waitForTimeout(500);assert.equal(await page.locator('[data-qty]').inputValue(),'2');await page.locator('#note').focus();await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='3');
page.once('dialog',d=>d.accept());await page.locator('#discard').click();await page.waitForFunction(()=>window.usbTarget===null);
assert.equal(await page.locator('#pair-code').count(),0);
// A temporary loss of internet keeps the cached scanner and saved draft usable.
await context.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',route=>route.abort());await page.goto('http://127.0.0.1:'+server.address().port+'/warehouse-terminal.html');await page.locator('#pay').click();await page.keyboard.type('FGP-00000001',{delay:5});await page.waitForFunction(()=>document.querySelector('[data-qty]')?.value==='1');await page.locator('#send').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Нет связи'));assert.equal(await page.locator('[data-qty]').inputValue(),'1');
await page.locator('#back').click();await page.reload();await page.locator('#pay').click();assert.equal(await page.locator('[data-qty]').inputValue(),'1');assert.equal(await page.locator('#rebind,#setup,#pair-code').count(),0);
// A fresh authenticated terminal gets one station automatically, without a pairing code.
const fresh=await browser.newContext({viewport:{width:320,height:480}});await fresh.addInitScript(({actor})=>localStorage.setItem('fastgo_warehouse_session_v1',JSON.stringify({user_id:actor,access_token:'test',expires_at:4102444800})),{actor});let stationChoices=1,connectPayload,connectAttempts=0;
await fresh.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{const p=route.request().postDataJSON()||{};let data;if(p.action==='stations')data=Array.from({length:stationChoices},(_,i)=>({id:'55555555-5555-4555-8555-'+String(i+1).padStart(12,'0'),name:'Склад',created_at:'2026-10-15T13:3'+i+':00Z'}));if(p.action==='connect_terminal'){connectAttempts++;if(connectPayload)assert.deepEqual(p,connectPayload);connectPayload=p;if(connectAttempts===1)return route.abort();data={id:p.terminal_id,token:p.token,station_id:p.station_id,name:'Склад'};}if(p.action==='info')data={device:{name:'Склад',kind:'terminal'},member:{role:'owner'}};if(p.action==='catalog')data={parts:[{id:part,name:'Колодки',barcode:'FGP-00000001',quantity:5,active:true}],staff:[]};await route.fulfill({json:{data},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});});
const newTerminal=await fresh.newPage();await newTerminal.goto('http://127.0.0.1:'+server.address().port+'/warehouse-terminal.html');await newTerminal.locator('#retry').click();await newTerminal.locator('#pay').waitFor();assert.equal(connectAttempts,2);assert.equal(await newTerminal.locator('#setup,#rebind,#pair-code').count(),0);assert.equal(await newTerminal.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
stationChoices=2;connectPayload=null;await newTerminal.evaluate(actor=>localStorage.removeItem('fgwarehouse:'+actor+':terminal'),actor);await newTerminal.reload();await newTerminal.locator('#stations button').first().waitFor();assert.equal(await newTerminal.locator('#stations button').count(),2);assert.equal(connectAttempts,2);await newTerminal.locator('#stations button').last().click();await newTerminal.locator('#pay').waitFor();assert.match(connectPayload.station_id,/000000000002$/);await fresh.close();
console.log('PASS: working terminal boot, code-free connection, lost connection response retry, offline draft recovery, scanner focus, no suffix / Enter / Tab, no double add, manual entry, note/quantity isolation, error recovery, batched input, screen cleanup, handoff and master checkout');await context.close();}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
