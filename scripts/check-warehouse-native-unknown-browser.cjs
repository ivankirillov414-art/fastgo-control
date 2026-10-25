const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions,catalog}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await api.connect(context,false);const page=await context.newPage();page.setDefaultTimeout(15000);
 const id='88888888-8888-4888-8888-888888888888';api.jobs.set(id,{id,state:'queued',payload:{kind:'unknown',document_kind:'receipt',code:'UNKNOWN-NEW',items:[]}});
 await page.goto(base+'/warehouse.html');await page.locator('[data-unknown]').waitFor();assert.equal(api.payments.length,0);await page.locator('[data-unknown]').click();
 await page.locator('#unknown-filter').fill(catalog[0].name);await page.locator('#unknown-part').selectOption(catalog[0].id);await page.getByRole('button',{name:'Связать с товаром',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.unknown-dialog'));
 assert.equal(api.jobs.get(id).state,'done');assert.equal(api.jobs.get(id).result.part.id,catalog[0].id);assert.equal(api.payments.length,0);
 // A long QR must remain cancellable at the cash laptop display scale.
 const long=base+'/workshop.html#order?kind=repair&id=359b6650-b0a6-4260-88b7-7c54b99a3fcf'+'x'.repeat(200);
 api.jobs.set(id,{id,state:'queued',payload:{kind:'unknown',document_kind:'sale',code:long,items:[]}});
 await page.addInitScript(()=>{window.addEventListener('DOMContentLoaded',()=>document.body.classList.add('warehouse-native-window'));window.warehouseDesktop={desktopStatus:async()=>({version:'1.0.21',usb:{status:'Готов',pending:6},update:{status:'ready',version:'1.0.21'}})};});
 await page.reload();await page.locator('[data-unknown]').waitFor();
 const button=await page.locator('[data-unknown]').elementHandle();await page.waitForTimeout(3200);assert.equal(await button.evaluate(el=>el.isConnected),true,'polling must not replace the clicked button');
 for(const width of [1250,1000,900,850]){
  await page.setViewportSize({width,height:650});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow at '+width);
  const brand=await page.locator('.warehouse-top-brand').boundingBox(),scanner=await page.locator('#usb-scanner').boundingBox();assert(brand.x+brand.width<=scanner.x,'brand must not overlap buttons');
  const header=await page.locator('header').boundingBox();assert.equal(header.y,0);assert.equal(header.height,64);
  for(const selector of ['#logout','#usb-scanner']){const box=await page.locator(selector).boundingBox();assert(box.x+box.width<=width-148,'caption controls must stay clear at '+width);}
  await page.locator('body').evaluate(el=>{el.style.minHeight='1800px';});await page.evaluate(()=>scrollTo(0,300));assert.equal((await page.locator('header').boundingBox()).y,0);await page.evaluate(()=>scrollTo(0,0));
 }
 await page.locator('[data-unknown]').click();await page.locator('.unknown-dialog').waitFor();
 page.once('dialog',d=>d.dismiss());await page.locator('[data-cancel-scan]').click();assert.equal(api.jobs.get(id).state,'queued');
 page.once('dialog',d=>d.accept());await page.locator('[data-cancel-scan]').click();await page.waitForFunction(()=>!document.querySelector('.unknown-dialog'));
 assert.equal(api.jobs.get(id).result.cancelled,true);assert.equal(api.payments.length,0);await page.locator('[data-unknown]').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.warehouseUpdateSafe(true)),true);
 console.log('PASS: unknown scan cancellation, stable polling, long QR layout and Windows caption reserve at 850–1250 pixels');await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1);});
