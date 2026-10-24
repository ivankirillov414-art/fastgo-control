const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,scan,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),tc=await browser.newContext(),dc=await browser.newContext();await api.connect(tc,true);await api.connect(dc,false);
 const t=await tc.newPage(),d=await dc.newPage();for(const p of [t,d])p.setDefaultTimeout(10000);
 let installs=0;await d.exposeFunction('checkNative',()=>{installs++;return {status:'current'};});
 await d.addInitScript(()=>window.warehouseDesktop={checkUpdates:()=>window.checkNative(),desktopStatus:async()=>({version:'1.0.11',update:{status:'current'},usb:{status:'Готов',pending:0}})});
 await Promise.all([t.goto(base+'/warehouse-terminal.html'),d.goto(base+'/warehouse.html')]);await t.locator('#receipt').click();await scan(t);await d.locator('[data-live-qty]').waitFor();await d.locator('[data-live-qty]').fill('7');
 const original=d.url();await d.evaluate(()=>window.warehouseRequestUpdate());await d.waitForFunction(()=>document.getElementById('message').textContent.includes('Проверка выполнена'));assert.equal(installs,1);assert.equal(d.url(),original);assert.equal(await d.locator('[data-live-qty]').inputValue(),'7');assert.equal(await d.evaluate(()=>window.warehouseUpdateSafe(true)),false);
 await d.keyboard.press('F5');await d.waitForFunction(()=>document.getElementById('message').textContent.includes('Проверка выполнена'));assert.equal(d.url(),original);assert.equal(await d.locator('[data-live-qty]').inputValue(),'7');
 // A real renderer/browser restart, even offline, restores the mirror and quantity edits.
 await d.reload();await d.locator('[data-live-qty]').waitFor();assert.equal(await d.locator('[data-live-qty]').inputValue(),'7');
 let offline=true;await dc.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',route=>offline?route.abort():route.fallback());await d.reload();await d.locator('[data-live-qty]').waitFor();assert.equal(await d.locator('[data-live-qty]').inputValue(),'7');offline=false;
 await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments.length,1);assert.equal(api.payments[0].items[0].quantity,7);
 await t.locator('#pay').click();await scan(t);await d.locator('#live-payment').waitFor();await d.locator('input[value="transfer"]').check();await d.reload();await d.locator('#live-payment').waitFor();assert.equal(await d.locator('input[value="transfer"]').isChecked(),true);
 await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments.length,2);assert.equal(api.payments[1].payment_method,'transfer');await d.reload();await d.locator('#receipt').waitFor();assert.equal(await d.locator('.station-product').count(),0);
 offline=true;await d.locator('#receipt').click();await scan(d);await d.locator('[data-live-qty]').waitFor();await d.locator('[data-live-qty]').fill('4');await d.reload();await d.locator('[data-live-qty]').waitFor();assert.equal(await d.locator('[data-live-qty]').inputValue(),'4');offline=false;await d.locator('#live-submit').click();await d.locator('#receipt').waitFor();assert.equal(api.payments.length,3);assert.equal(api.payments[2].items[0].quantity,4);
 await d.locator('#inventory').click();await d.locator('#stock-list').waitFor();assert.equal(await d.evaluate(()=>window.warehouseUpdateSafe(true)),true);
 await d.locator('#filter').fill('Камера');assert.equal(await d.evaluate(()=>window.warehouseUpdateSafe(true)),true);
 const input=await d.evaluate(()=>{const el=document.createElement('input');document.body.append(el);el.focus();return window.warehouseUpdateSafe(true);});assert.equal(input,false);
 console.log('PASS: active documents block updates and survive restart; read-only stock and search allow a safe update; editable input still blocks');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
