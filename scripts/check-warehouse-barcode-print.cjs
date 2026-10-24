const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs'),{barcodePrintHTML}=require('../warehouse-desktop/barcode-print.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),context=await browser.newContext({viewport:{width:1366,height:850}});await api.connect(context,false);
 await context.addInitScript(()=>{window.printRequests=[];window.warehouseDesktop={printBarcode:async p=>{window.printRequests.push(p);return true;}};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/warehouse.html');await page.locator('#inventory').click();await page.locator('.inventory-item').first().click();await page.getByRole('button',{name:'Печать штрихкодов'}).click();
 const dialog=page.getByRole('dialog',{name:'Печать штрихкодов'});await dialog.getByRole('spinbutton').fill('3');await dialog.locator('select').selectOption('a4');await dialog.getByRole('button',{name:'Печать',exact:true}).click();await dialog.waitFor({state:'detached'});
 const [payload]=await page.evaluate(()=>window.printRequests);assert.equal(payload.quantity,3);assert.equal(payload.format,'a4');assert.match(payload.barcode,/FGP/);const html=barcodePrintHTML(payload);
 const preview=await context.newPage();await preview.setContent(html);assert.equal(await preview.locator('.label').count(),3);assert.ok(await preview.locator('.label').first().locator('rect').count()>10);fs.mkdirSync('browser-results',{recursive:true});await preview.screenshot({path:'browser-results/barcode-labels.png'});await preview.pdf({path:'browser-results/barcode-labels.pdf',preferCSSPageSize:true,printBackground:true});assert.deepEqual(errors,[]);
 console.log('PASS: product card → label count → native print request, real CODE128 bars, three labels and printable A4 PDF');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
