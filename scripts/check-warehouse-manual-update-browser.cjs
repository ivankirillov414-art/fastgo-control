const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 for(const width of [1366,820,390]){
  const api=backend(),context=await browser.newContext({viewport:{width,height:844}});await api.connect(context,false);let holdCatalog=false,releaseCatalog,onHeld;const hold=()=>{holdCatalog=true;return new Promise(resolve=>onHeld=resolve);};await context.route('**/functions/v1/fastgo-warehouse',async route=>{if(holdCatalog&&route.request().postDataJSON()?.action==='work_catalog'){holdCatalog=false;await new Promise(resolve=>{releaseCatalog=resolve;onHeld();});}await route.fallback();});const page=await context.newPage();page.on('dialog',d=>d.accept());await page.goto(base+'/warehouse.html');
  const open=async(waitReady=true)=>{await page.locator('#nav-pay').click();await page.locator('#manual-service-payment').click();await page.locator('[data-add] [name=work]').waitFor();if(waitReady)await page.locator('#service-choices option').first().waitFor({state:'attached'});};
  const reload=async()=>{await page.evaluate(()=>window.__previousManualRenderer=true);await page.reload();assert.equal(await page.evaluate(()=>window.__previousManualRenderer),undefined,'A real renderer reload must occur');};
  const safe=async()=>{await page.getByRole('heading',{name:'Ручная оплата работ',exact:true}).click();return page.evaluate(()=>window.warehouseUpdateSafe(true));};
  await open();assert.equal(await safe(),true,'An empty manual payment must not block update installation');
  await page.locator('[data-add] [name=work]').fill('Неотправленная работа');assert.equal(await safe(),false);
  await reload();await open();assert.equal(await page.locator('[data-add] [name=work]').inputValue(),'Неотправленная работа');assert.equal(await safe(),false);await page.locator('[data-cancel]').click();
  await open();assert.equal(await safe(),true);
  await page.locator('[data-payment] [name=total]').fill('1600');assert.equal(await safe(),false);await reload();await open();assert.equal(await page.locator('[data-payment] [name=total]').inputValue(),'1600');assert.equal(await safe(),false);await page.locator('[data-cancel]').click();
  await open();await page.locator('[data-payment] [name=method][value=cash]').check();assert.equal(await safe(),false);await page.locator('[data-cancel]').click();await open();assert.equal(await safe(),true);
  await page.locator('[data-cancel]').click();const waiting=hold();await open(false);await waiting;await page.locator('[data-add] [name=work]').fill('Замена камеры');await page.locator('[data-payment] [name=total]').fill('777');releaseCatalog();await page.locator('#service-choices option').first().waitFor({state:'attached'});assert.equal(await page.locator('[data-payment] [name=total]').inputValue(),'777','Late catalog must preserve the entered total');await page.locator('[data-cancel]').click();
  assert.equal(api.state.servicePayments.length,0);assert.equal(api.state.parts[0].quantity,20);assert.equal(api.state.stockIntakes.length,0);await context.close();console.log('PASS '+width+': empty manual update, partial entry/reload protection, total, payment method and cancel; no business mutations');
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
