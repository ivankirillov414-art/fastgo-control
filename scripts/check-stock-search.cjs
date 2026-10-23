const path=require('node:path'),assert=require('node:assert/strict');
const playwright=require(process.env.FASTGO_PLAYWRIGHT?path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'):'playwright');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve();try{for(const kind of (process.env.FASTGO_SEARCH_BROWSERS||'chromium,webkit').split(',')){
 const browser=await playwright[kind].launch(kind==='chromium'?launchOptions:{headless:true});try{
 const api=backend();api.state.parts=Array.from({length:20},(_,i)=>({id:'part-'+i,name:'Амортизатор '+(i+1),model:'M'+i,sku:'FGP-'+String(i+1).padStart(3,'0'),barcode:'FGP-'+String(i+1).padStart(8,'0'),quantity:2,retail_price:1200,active:true}));
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];await api.connect(context,false,{unified:true,readonly:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/workshop.html#stock');await page.waitForURL('**/warehouse.html?unified=1&section=inventory');const input=page.locator('#filter');await input.waitFor();assert.equal(await page.locator('.inventory-item').count(),20);
 for(const [query,name] of [['FGP-007','Амортизатор 7'],['FGP-00000015','Амортизатор 15'],['M19','Амортизатор 20']]){await input.fill(query);assert.equal(await page.locator('.inventory-item').count(),1);assert.match(await page.locator('.inventory-item').innerText(),new RegExp(name));}
 await input.fill('нет такой детали');await page.locator('.inventory-empty').waitFor();await input.fill('');assert.equal(await page.locator('.inventory-item').count(),20);
 await input.fill('FGP-007');await page.locator('.inventory-item').click();await page.locator('.product-dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await input.inputValue(),'FGP-007');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.setViewportSize({width:1366,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
 console.log('PASS: '+kind+' common warehouse search by name, SKU, barcode and model; empty result, preserved search after card, mobile/desktop layout');await context.close();
 }finally{await browser.close();}
 }}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
