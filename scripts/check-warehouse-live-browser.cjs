const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve,backend,scan,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),browser=await chromium.launch(launchOptions);try{
 const api=backend(),tc=await browser.newContext({viewport:{width:320,height:480}}),dc=await browser.newContext({viewport:{width:1280,height:800}});await api.connect(tc,true);await api.connect(dc,false);
 const t=await tc.newPage(),d=await dc.newPage(),errors=[];for(const p of [t,d]){p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));}
 await Promise.all([t.goto(base+'/warehouse-terminal.html'),d.goto(base+'/warehouse.html')]);await t.locator('#pay').waitFor();
 assert.equal(await t.locator('#resume,#back').count(),0);assert.equal(await t.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true);
 await t.locator('#receipt').click();await t.locator('.scan-empty').waitFor();
 assert.equal(await t.locator('#live-items').innerText(),'');assert.equal(await t.locator('#live-submit,#live-payment').count(),0);assert.equal(await t.getByRole('button',{name:'Добавить',exact:true}).count(),0);
 assert.equal(await t.locator('#live-code').getAttribute('inputmode'),'none');assert.equal(await t.locator('#live-code').evaluate(el=>getComputedStyle(el.closest('form')).opacity),'0');
 // Keep the editor writable across hide/resume: Android scanner IMEs need an input connection.
 await t.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await t.locator('#live-code').evaluate(el=>el.readOnly),false);
 assert.equal(await t.locator('#live-code').evaluate(el=>document.activeElement===el),false);
 await t.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await t.locator('#live-code').evaluate(el=>el.readOnly),false);
 assert.equal(await t.locator('#live-code').evaluate(el=>document.activeElement===el),true);
 // A scanner IME must see an editable input at the exact moment focus is acquired.
 const focusReadonly=await t.evaluate(()=>{const el=document.getElementById('live-code'),seen=[];el.addEventListener('focus',()=>seen.push(el.readOnly));el.blur();window.dispatchEvent(new Event('focus'));return seen;});
 assert.deepEqual(focusReadonly,[false]);
 // Empty implicit Enter must not claim an operation is in progress.
 await t.evaluate(()=>document.getElementById('live-scan').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(await t.locator('#scan-feedback').innerText(),'');
 // Scanner services can insert a complete value after transient WebView focus loss.
 await t.evaluate(()=>{window.dispatchEvent(new Event('blur'));const el=document.getElementById('live-code');el.blur();el.value='FGP-00000002';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await t.locator('.last-scan').waitFor();await d.locator('[data-live-qty]').waitFor();
 assert.equal(await t.locator('.last-scan').count(),1);
 await d.locator('#live-submit').click();await t.locator('#pay').waitFor();api.payments.length=0;
 await t.locator('#receipt').click();await t.locator('.scan-empty').waitFor();
 await t.screenshot({path:'/tmp/fastgo-tsd-waiting.png'});
 // Android IME insertion emits composition/change, while keyboard scanners use Enter/Tab or a fast burst.
 await t.evaluate(()=>{const el=document.getElementById('live-code');el.value='FGP-00000001';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await t.locator('.last-scan').waitFor();await d.locator('[data-live-qty]').waitFor();assert.equal(await d.locator('h1').innerText(),'Приход');
 await d.locator('[data-live-qty]').fill('5');
 await scan(t);await t.waitForFunction(()=>document.querySelector('.last-scan p').textContent==='2 шт.');
 await scan(t,'FGP-00000002','Tab');await d.waitForFunction(()=>document.querySelectorAll('.station-product').length===2);
 assert.equal(await t.locator('.last-scan h2').innerText(),'Камера 10 × 2,5');assert.equal(await t.locator('.last-scan').count(),1);
 assert.equal(await d.locator('[data-live-qty]').first().inputValue(),'5');assert.equal(await d.locator('[data-live-qty]').first().evaluate(el=>el===document.activeElement),true);
 await d.locator('h1').click();assert.equal(await d.locator('[data-live-qty]').first().inputValue(),'6');
 await d.screenshot({path:'/tmp/fastgo-laptop-receipt.png'});await t.screenshot({path:'/tmp/fastgo-tsd-result.png'});
 await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments[0].action,'live_receive');assert.deepEqual(api.payments[0].items.map(x=>x.quantity),[6,1]);
 for(const method of ['cash','card','transfer']){
  await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();await scan(t,'FGP-00000001','');await t.locator('.last-scan').waitFor();await scan(t,'FGP-00000001','Tab');await scan(t,'FGP-00000002');
  await d.waitForFunction(()=>document.querySelectorAll('.station-product').length===2&&document.querySelector('[data-count]')?.textContent==='2 шт.');
  assert.equal(await d.locator('h1').innerText(),'Оплата');assert.match(await d.locator('#live-total').innerText(),/2.?700/);assert.equal(await d.locator('input[name="live-method"]').count(),3);
  assert.equal(await t.locator('#live-submit,#live-payment,[data-live-qty]').count(),0);assert.equal(await t.locator('.last-scan h2').innerText(),'Камера 10 × 2,5');
  await d.locator('input[value="'+method+'"]').check();if(method==='card')await d.screenshot({path:'/tmp/fastgo-laptop-payment.png'});
  await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments.at(-1).payment_method,method);assert.deepEqual(api.payments.at(-1).items.map(x=>x.quantity),[2,1]);
 }
 // Laptop retry retains the frozen method after the server accepted the operation.
 await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();await scan(t);await d.locator('#live-submit').waitFor();await d.locator('input[value="card"]').check();api.state.holdPayment=true;await d.locator('#live-submit').click();
 await d.waitForFunction(()=>document.querySelector('input[value="card"]')?.disabled===true);await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments.at(-1).payment_method,'card');
 // Offline scans survive reload and reach the laptop without a manual send button.
 await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();api.state.offline=true;await scan(t);await t.locator('.last-scan').waitFor();await t.locator('#live-back').click();await t.reload();await t.locator('#pay').click();await t.locator('.last-scan').waitFor();
 api.state.offline=false;await d.locator('#live-submit').waitFor();await d.locator('input[value="cash"]').check();await d.locator('#live-submit').click();await t.locator('#pay').waitFor();assert.equal(api.payments.at(-1).items[0].quantity,1);
 // Unknown code is visible as an error; the next hardware scan works without tapping the sink.
 await t.locator('#pay').click();await t.locator('.scan-empty').waitFor();await scan(t,'UNKNOWN-CODE');await t.waitForFunction(()=>document.getElementById('scan-feedback').textContent.includes('не найден'));
 await d.locator('#pay').click();await d.locator('.scan-empty').waitFor();
 await scan(t,'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+api.quote.id);
 await t.getByRole('heading',{name:'Ремонт № 0026'}).waitFor();await d.locator('#repair-pay').waitFor();assert.equal(await t.locator('#repair-pay,#repair-check').count(),0);
 await d.locator('input[name="repair-method"][value="transfer"]').check();await d.locator('#repair-pay').click();await t.locator('#pay').waitFor();assert.equal(api.state.repairPaid,true);assert.equal(api.payments.at(-1).payment_method,'transfer');
 assert.equal(await t.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS: scan-only TSD, automatic receipt/payment on laptop, repeated and multiple goods, quantities survive incoming scans, three payment methods, retry, offline resume, Android IME/Enter/Tab/no suffix, repair QR');
 await tc.close();await dc.close();
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
