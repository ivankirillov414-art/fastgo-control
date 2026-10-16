const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),context=await browser.newContext({viewport:{width:1366,height:850}});await api.connect(context,false);const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/warehouse.html');await page.locator('#inventory').click();await page.locator('.inventory-item').first().click();const dialog=page.locator('.product-dialog');await dialog.waitFor();
 assert.equal(await dialog.locator('h2').innerText(),'Покрышка 10 × 2,5');assert.match(await dialog.locator('.product-sku').innerText(),/FGP-037/);assert.equal(await dialog.locator('[data-edit]').count(),2);assert.equal(await dialog.locator('#product-barcode rect').count()>10,true);
 await page.screenshot({path:'/tmp/fastgo-product-concept4.png'});
 await dialog.locator('[data-edit="quantity"]').click();await dialog.getByRole('spinbutton',{name:'Новый остаток'}).fill('0');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-metric="quantity"]>strong')?.textContent.startsWith('0 '));
 assert.match(await page.locator('.inventory-item').first().innerText(),/0 шт./);assert.equal(api.state.edits[0].expected,20);assert.equal(api.state.edits[0].value,0);
 await dialog.locator('[data-edit="retail_price"]').click();await dialog.getByRole('spinbutton',{name:'Новая цена'}).fill('1500.50');api.state.failEditResponse=true;await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await dialog.locator('.product-error').filter({hasText:'Нет связи'}).waitFor();
 await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-metric="retail_price"]>strong')?.textContent.includes('500,50'));
 assert.equal(api.state.edits.at(-1).request_id,api.state.edits.at(-2).request_id);assert.match(await page.locator('.inventory-item').first().innerText(),/1.?500,50/);
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.locator('.inventory-item').first().focus();await page.keyboard.press('Enter');await dialog.waitFor();await dialog.getByRole('button',{name:'Закрыть карточку'}).click();
 // Reopening before a queued close event cannot remove the next product dialog.
 await page.locator('.inventory-item').last().click();await dialog.waitFor();assert.match(await dialog.locator('h2').innerText(),/Камера/);await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.locator('.inventory-item').first().click();await dialog.waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:'/tmp/fastgo-product-mobile.png'});await page.keyboard.press('Escape');
 api.state.role='seller';await page.reload();await page.locator('#inventory').click();await page.locator('.inventory-item').first().click();await dialog.waitFor();assert.equal(await dialog.locator('[data-edit]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: concept-4 product panel, valid barcode SVG, click/keyboard/close/reopen, zero stock and price edit, durable same-request retry, list-only refresh, permissions, mobile overflow');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
