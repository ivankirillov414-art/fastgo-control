const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const width of [1366,820,390]){
  const api=backend(),context=await browser.newContext({viewport:{width,height:844}});await api.connect(context,false);const page=await context.newPage();page.on('dialog',d=>d.accept());await page.goto(base+'/warehouse.html');
  const open=async()=>{await page.locator('#nav-pay').click();await page.locator('#manual-service-payment').click();await page.locator('[data-add] [name=work]').waitFor();};
  const reload=async()=>{await page.evaluate(()=>window.__previousManualRenderer=true);await page.reload();assert.equal(await page.evaluate(()=>window.__previousManualRenderer),undefined,'A real renderer reload must occur');};
  const safe=async()=>{await page.getByRole('heading',{name:'Ручная оплата работ',exact:true}).click();return page.evaluate(()=>window.warehouseUpdateSafe(true));};
  await open();assert.equal(await safe(),true,'An empty manual payment must not block update installation');
  await page.locator('[data-add] [name=work]').fill('Неотправленная работа');assert.equal(await safe(),false);
  await reload();await open();assert.equal(await page.locator('[data-add] [name=work]').inputValue(),'Неотправленная работа');assert.equal(await safe(),false);await page.locator('[data-cancel]').click();
  await open();await page.locator('[data-add] [name=price]').fill('0');assert.equal(await safe(),false,'A typed zero price is user input');await page.locator('[data-add] [name=price]').fill('');assert.equal(await safe(),true);
  await page.locator('[data-payment] [name=total]').fill('1600');assert.equal(await safe(),false);await reload();await open();assert.equal(await page.locator('[data-payment] [name=total]').inputValue(),'1600');assert.equal(await safe(),false);await page.locator('[data-cancel]').click();
  await open();await page.locator('[data-payment] [name=method][value=cash]').check();assert.equal(await safe(),false);await page.locator('[data-cancel]').click();await open();assert.equal(await safe(),true);
  assert.equal(api.state.servicePayments.length,0);assert.equal(api.state.parts[0].quantity,20);assert.equal(api.state.stockIntakes.length,0);await context.close();console.log('PASS '+width+': empty manual update, partial entry/reload protection, zero price, total, payment method and cancel; no business mutations');
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
