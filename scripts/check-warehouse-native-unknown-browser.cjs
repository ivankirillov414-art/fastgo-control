const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions,catalog}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),context=await browser.newContext({viewport:{width:1280,height:800}});await api.connect(context,false);const page=await context.newPage();page.setDefaultTimeout(15000);
 const id='88888888-8888-4888-8888-888888888888';api.jobs.set(id,{id,state:'queued',payload:{kind:'unknown',document_kind:'receipt',code:'UNKNOWN-NEW',items:[]}});
 await page.goto(base+'/warehouse.html');await page.locator('[data-unknown]').waitFor();assert.equal(api.payments.length,0);await page.locator('[data-unknown]').click();
 await page.locator('#unknown-filter').fill(catalog[0].name);await page.locator('#unknown-part').selectOption(catalog[0].id);await page.getByRole('button',{name:'Связать с товаром',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.unknown-dialog'));
 assert.equal(api.jobs.get(id).state,'done');assert.equal(api.jobs.get(id).result.part.id,catalog[0].id);assert.equal(api.payments.length,0);
 console.log('PASS: native unknown code resolves to existing stock item on laptop without payment or stock movement');await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exit(1);});
