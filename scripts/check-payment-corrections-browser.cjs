const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const playwright=require('playwright'),{serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{
 const kind=process.argv[2]||'chromium';
 const {fixture,owner,paidRepair}=await import(pathToFileURL(path.resolve('tests/payment-correction-fixture.mjs')));
 const {paymentCorrections}=await import(pathToFileURL(path.resolve('supabase/functions/fastgo-warehouse/payment-corrections.js')));
 const {finalReport}=await import(pathToFileURL(path.resolve('supabase/functions/fastgo-warehouse/final-report.js')));
 const {server,base}=await serve(),browser=await playwright[kind].launch(kind==='chromium'?launchOptions:{headless:true});
 try{
  for(const [bundle,width] of [['warehouse-desktop',1366],['desktop',390]]){
   const context=await browser.newContext({viewport:{width,height:820}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const h=fixture(),wrong=h.run('sale',{shift_id:h.shift,payment_method:'transfer',items:[{part_id:h.a,quantity:1}]}),right=h.run('sale',{shift_id:h.shift,payment_method:'cash',items:[{part_id:h.b,quantity:2}]}),receipts=new Map(),requests=[];
   let version=1,lose=false,hold=null,release=null,editable=true,catalogRefreshes=0;
   const db=async(p,q,m,b)=>{
    if(p==='workshop_native_receipts'){const r=receipts.get(new URLSearchParams(q).get('request_id').slice(3));return r?[r]:[];}
    if(p==='rpc/workshop_native_snapshot')return structuredClone({sheets:h.sheets,version});
    if(p!=='rpc/workshop_native_commit')throw Error(p);if(b.p_version!==version)return {retry:true};
    h.apply({changes:b.p_changes,result:b.p_result});version++;receipts.set(b.p_request_id,{actor_id:b.p_actor,action:b.p_action,fingerprint:b.p_fingerprint,result:b.p_result});
    if(lose){lose=false;throw Error('Проверка обрыва ответа');}return {result:b.p_result};
   };
   await page.exposeFunction('paymentTestCall',async(action,p)=>{
    try{
     if(action==='final_report')return {data:finalReport(h.sheets,p,{can_manage:editable})};
     requests.push({action,...p});if(hold&&action==='payment_correction_preview')await hold;
     return {data:await paymentCorrections(action,p,{db,actor:owner,device:{kind:'station'},digest:async s=>createHash('sha256').update(s).digest('hex')})};
    }catch(e){return {error:e.message,status:e.status};}
   });
   await page.exposeFunction('paymentCatalogRefresh',()=>{catalogRefreshes++;});
   await context.route(base+'/_payment-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/'+bundle+'/web/warehouse/style.css"><body><main id="report"></main></body></html>'}));
   if(bundle==='warehouse-desktop'){await page.goto(base+'/'+bundle+'/web/warehouse.html');await page.locator('#login').waitFor();assert.deepEqual(errors,[],'the standalone ESM dependency tree must boot');}
   await page.goto(base+'/_payment-test');if(bundle==='desktop')await page.evaluate(()=>window.fastgoDesktop={getSession:async()=>null});
   await page.evaluate(async url=>{const {mountFinalReport}=await import(url);window.paymentReport=mountFinalReport({root:document.querySelector('#report'),call:async(a,p)=>{const r=await window.paymentTestCall(a,p);if(r.error)throw Object.assign(Error(r.error),{status:r.status});return r.data;},onCorrected:window.paymentCatalogRefresh});await paymentReport.ready;},base+'/'+bundle+'/web/warehouse/final-report.js');
   await page.locator('details[data-method=transfer] summary').click();
   hold=new Promise(resolve=>release=resolve);await page.locator('[data-payment-void="sale:'+wrong.id+'"]').click();await page.getByText('Загружаем исходную оплату…').waitFor();assert.equal(await page.locator('dialog button[type=submit]').count(),0,'save must not exist before a fresh preview');release();hold=null;
   const dialog=page.locator('dialog');await dialog.locator('[name=reason]').fill('Клиент оплатил другую покупку наличными');await dialog.locator('button[type=submit]').click();assert.equal(requests.filter(x=>x.action==='payment_correction').length,0,'returned-goods confirmation is mandatory');
   await dialog.locator('[name=returned]').check();lose=true;await dialog.locator('button[type=submit]').click();await dialog.locator('[data-error]').filter({hasText:'обрыва'}).waitFor();assert.equal(h.stock(h.a),5);assert.equal(await dialog.locator('[name=reason]').isDisabled(),true);
   await dialog.locator('button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(requests.filter(x=>x.action==='payment_correction')[0].request_id,requests.filter(x=>x.action==='payment_correction')[1].request_id);assert.equal(receipts.size,1);assert.equal(h.stock(h.a),5);assert.equal(h.stock(h.b),5);assert.equal(h.report().total,700);assert.equal(catalogRefreshes,1);
   assert.match(await page.locator('.payment-state').filter({hasText:'Отменена'}).innerText(),/Отменена.*Клиент оплатил/);assert.equal(await page.locator('[data-payment-void="sale:'+wrong.id+'"]').count(),0);
   await page.locator('details[data-method=cash] summary').click();await page.locator('[data-payment-edit="sale:'+right.id+'"]').click();await dialog.locator('[name=amount]').fill('650.45');await dialog.locator('[name=method]').selectOption('card');await dialog.locator('[name=reason]').fill('Уточнены сумма и способ оплаты');await dialog.locator('button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(h.report().total,650.45);assert.equal(h.stock(h.b),5);assert.equal(h.report().groups.find(g=>g.method==='card').total,650.45);
   const {record,payment}=paidRepair(h);await page.locator('[data-refresh]').click();await page.locator('[data-payment-void="payment:'+payment.payment_id+'"]').click();await dialog.locator('[name=reason]').fill('Ошибочная оплата ремонта');assert.equal(await dialog.locator('[name=returned]').count(),0);await dialog.locator('button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(h.run('get',{kind:'repair',id:record.id}).record.paid_amount,0);assert.equal(h.run('get',{kind:'repair',id:record.id}).record.status,'ready');
   editable=false;await page.locator('[data-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-grand-total]').textContent!=='—');assert.equal(await page.locator('[data-payment-edit],[data-payment-void]').count(),0);
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   fs.mkdirSync('browser-results/payment-corrections',{recursive:true});await page.screenshot({path:'browser-results/payment-corrections/'+kind+'-'+bundle+'-'+width+'.png',fullPage:true});
   console.log('PASS '+kind+' '+bundle+' '+width+': fresh preview, stock confirmation, lost reply replay, correct payment preservation, amount/method edit, repair cancellation and role controls');await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
