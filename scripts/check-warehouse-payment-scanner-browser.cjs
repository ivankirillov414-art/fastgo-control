const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await api.connect(context,false);
 const calls=[],receipts=new Map();let lose=true;
 await context.route('**/functions/v1/fastgo-warehouse',async route=>{
  const p=route.request().postDataJSON()||{};calls.push(p);
  if(!['parts_issue','parts_pickup_quote'].includes(p.action))return route.fallback();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type'};
  if(p.action==='parts_pickup_quote')return route.fulfill({headers,json:{data:{number:'0026',master_name:'Мастер'}}});
  if(!receipts.has(p.request_id)){receipts.set(p.request_id,structuredClone(p));assert.equal(p.items[0].quantity,2);}
  else assert.deepEqual(p,receipts.get(p.request_id));
  if(lose){lose=false;return route.fulfill({status:503,headers,json:{error:'Ответ потерян'}});}
  return route.fulfill({headers,json:{data:{number:'0026',master_name:'Мастер'}}});
 });
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const scan=async code=>{await page.locator('h1').click();await page.keyboard.type(code,{delay:1});await page.keyboard.press('Enter');};
 await page.goto(base+'/warehouse.html');await page.locator('#receipt').waitFor();
 // A cash scanner never adds stock, even when the receipt screen is open.
 await page.locator('#nav-receipt').click();await scan('FGP-00000001');await page.locator('#live-items').filter({hasText:'Покрышка'}).waitFor();
 assert.equal(await page.locator('#live-submit').innerText(),'Принять оплату');
 await scan('ъС0АПЗ-00000001');await page.locator('[data-count]').filter({hasText:'2 шт.'}).waitFor();
 assert(!calls.some(p=>p.action==='live_receive'||p.action==='receipt'));
 // Wrong URLs and unknown products leave no queue jobs.
 await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.includes(':live:sale:station')&&JSON.parse(localStorage.getItem(k)||'null')?.acked===3));
 let count=calls.filter(p=>p.action==='draft_sync').length;
 await scan('https://example.invalid/wrong');await page.locator('#message').filter({hasText:'QR ремонта'}).waitFor();
 await scan('UNKNOWN-000000');await page.locator('#message').filter({hasText:'Скан отменён'}).waitFor();
 assert.equal(calls.filter(p=>p.action==='draft_sync').length,count);
 const qr='FGPARTS1.demo.signed';await scan(qr);await page.locator('#message').filter({hasText:'Ответ потерян'}).waitFor();
 assert.equal(receipts.size,1);assert.equal(api.payments.length,0);
 // A retry after a committed issue reuses its receipt, closes the sale buffer,
 // and never calls a payment endpoint.
 await scan(qr);await page.locator('#message').filter({hasText:'Запчасти выданы в ремонт № 0026'}).waitFor();
 assert.equal(receipts.size,1);assert.equal(api.payments.length,0);assert(!calls.some(p=>['live_pay','checkout','live_receive','receipt'].includes(p.action)));
 await scan('https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id=66666666-6666-4666-8666-666666666666');
 await page.locator('#repair-pay').waitFor();assert.equal(await page.locator('h1').innerText(),'Оплата ремонта');assert(calls.some(p=>p.action==='repair_quote'));
 assert.equal(api.payments.length,0);assert.deepEqual(errors,[]);
 const fresh=backend(),freshContext=await browser.newContext({viewport:{width:1280,height:800}});await fresh.connect(freshContext,false);const freshPage=await freshContext.newPage();await freshPage.goto(base+'/warehouse.html');await freshPage.locator('#receipt').waitFor();fresh.state.parts.push({id:'99999999-9999-4999-8999-999999999999',name:'Новая деталь',barcode:'FGP-00000999',quantity:2,retail_price:100,active:true});await freshPage.locator('h1').click();await freshPage.keyboard.insertText(']C0FGP-00000999');await freshPage.keyboard.press('Enter');await freshPage.locator('#live-items').filter({hasText:'Новая деталь'}).waitFor();await freshPage.waitForFunction(()=>Object.keys(localStorage).some(k=>k.includes(':live:sale:station')&&JSON.parse(localStorage.getItem(k)||'null')?.acked>=2));assert.equal(fresh.jobs.size,1);assert.equal(fresh.payments.length,0);await freshContext.close();
 console.log('PASS: ATOL auto-routes products and repair QR; receipt mode receives no cash scans; pickup QR issues automatically; lost-response retry is idempotent, no sale or payment');
 await context.close();
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
