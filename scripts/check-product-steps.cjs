const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {serve,backend}=require('./warehouse-browser-fixture.cjs');
const {barcodePrintHTML}=require('../warehouse-desktop/barcode-print.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch();const out=path.resolve('browser-results/product-steps');fs.mkdirSync(out,{recursive:true});try{
 for(const width of [390,1366]){
  const api=backend(),context=await browser.newContext({viewport:{width,height:844}});await api.connect(context,false);
  await context.route('**/functions/v1/*',async route=>{const p=route.request().postDataJSON()||{};if(p.action==='label_targets')return route.fulfill({json:{data:[]},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}});return route.fallback();});
  const page=await context.newPage();page.setDefaultTimeout(12000);await page.goto(base+'/warehouse.html');await page.locator('#inventory').click();await page.locator('#new-part').click();const form=page.locator('.new-part-dialog');
  assert.equal(await form.locator('[name=sku],[name=unit]').count(),0);await form.locator('[data-product-next]').click();assert.equal(await form.locator('form').getAttribute('data-product-current'),'0');
  await form.locator('[name=name]').fill('Камера Макс Спид');await form.locator('[name=category]').fill('Камеры');await page.screenshot({path:path.join(out,'product-name-'+width+'.png')});await form.locator('[data-product-next]').click();
  await form.locator('[name=model]').fill('10 × 2,5');await form.locator('[name=unit_cost]').fill('120');await form.locator('[name=retail_price]').fill('300');await page.screenshot({path:path.join(out,'product-size-'+width+'.png')});
  await form.locator('[data-product-back]').click();assert.equal(await form.locator('[name=name]').inputValue(),'Камера Макс Спид');await form.locator('[data-product-next]').click();assert.equal(await form.locator('[name=model]').inputValue(),'10 × 2,5');await form.locator('[data-product-next]').click();await form.locator('[name=initial_quantity]').fill('5');await page.screenshot({path:path.join(out,'product-confirm-'+width+'.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await form.locator('[type=submit]').click();await page.locator('.product-dialog').waitFor();assert.equal(api.state.productSaves.length,1);assert.equal(api.state.stockIntakes.length,1);assert.equal(api.state.productSaves[0].name,'Камера Макс Спид');assert.equal(api.state.productSaves[0].model,'10 × 2,5');assert.equal(api.state.productSaves[0].sku,undefined);assert.equal(api.state.productSaves[0].unit,'шт');
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:500,height:320},deviceScaleFactor:203/96});await page.goto(base+'/warehouse.html');
 const svg=await page.evaluate(()=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');JsBarcode(svg,'FGP-00000002',{format:'CODE128',displayValue:false,width:2,height:72,margin:0,marginLeft:20,marginRight:20});return svg.outerHTML;});
 const decoder=await browser.newPage();await decoder.goto(base+'/warehouse.html');await decoder.addScriptTag({url:base+'/vendor/zxing-browser-0.2.1.min.js'});
 for(const deviceName of ['P2 Label Printer','4BARCODE 3B-365B'])for(const heightMm of [20,27]){
  await page.setContent(barcodePrintHTML({name:'Камера Макс Спид',model:'10 × 2,5',sku:'FG-00000002',price:300,barcode:'FGP-00000002',quantity:1,format:'label',deviceName,widthMm:50,heightMm,svg}));
  const bounds=await page.locator('.label').evaluate(label=>{const r=label.getBoundingClientRect(),els=['.label-heading','.label-details','svg','small'].map(s=>{const el=label.querySelector(s),b=el.getBoundingClientRect();return {top:b.top-r.top,bottom:b.bottom-r.top,width:el.clientWidth,scroll:el.scrollWidth};});return {height:r.height,els};});
  for(const el of bounds.els){assert(el.top>=0&&el.bottom<=bounds.height);assert(el.scroll<=el.width+1);}for(let i=1;i<bounds.els.length;i++)assert(bounds.els[i-1].bottom<=bounds.els[i].top+.1);
  const raw=(await page.locator('.label svg').screenshot()).toString('base64');assert.equal(await decoder.evaluate(async raw=>(await new ZXingBrowser.BrowserMultiFormatReader().decodeFromImageUrl('data:image/png;base64,'+raw)).getText(),raw),'FGP-00000002');
  await page.locator('.label').screenshot({path:path.join(out,(deviceName.startsWith('P2')?'p2':'pc365')+'-'+heightMm+'.png')});
 }
 console.log('PRODUCT_STEPS_OK: phone/laptop, field validation, retained values, automatic SKU input omitted, stock write, label metadata and 20/27mm geometry');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
