const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url'),path=require('node:path');
const engines=require('playwright'),{serve,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{
 const {repairApiFixture,ownerId,masterId}=await import('../tests/helpers/repair-api-fixture.mjs');
 const {server,base}=await serve(),name=process.env.FASTGO_REPAIR_BROWSER||'chromium',browser=await engines[name].launch(name==='chromium'?launchOptions:{headless:true});
 const widths=process.env.FASTGO_REPAIR_WIDTHS?process.env.FASTGO_REPAIR_WIDTHS.split(',').map(Number):[320,390,1366];
 try{for(const width of widths)for(const role of ['owner','mechanic'])for(const withParts of [false,true]){
  const h=repairApiFixture(),initial=await h.create(),actor=role==='owner'?ownerId:masterId,context=await browser.newContext({viewport:{width,height:900}}),jobs=new Map(),errors=[],failed=[];
  let ticket=null,loseCompletion=role==='mechanic'&&withParts,losePayment=role==='owner'&&withParts;
  await context.addInitScript(id=>{if(!localStorage.getItem('fastgo_workshop_session'))localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:id,access_token:'fixture-'+id,expires_at:4102444800}));},actor);
  await context.route('https://**/*',async route=>{
   const request=route.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const b=request.postDataJSON()||{},p=b.params||{};
   if(request.url().includes('fastgo-avito'))return route.fulfill({headers,json:{data:{connected:false,notifications:[],popups_allowed:false}}});
   if(request.url().includes('fastgo-print-api')){if(b.action==='enqueue')jobs.set(p.request_id,p);return route.fulfill({headers,json:{data:{enabled:true,id:p.request_id}}});}
   if(!request.url().includes('fastgo-workshop-api')){failed.push({destination:new URL(request.url()).pathname,action:b.action});return route.fulfill({status:503,headers,json:{error:'Unexpected isolated browser destination'}});}
   const id=(request.headers().authorization||'').replace('Bearer fixture-',''),response=await h.request(b.action,p,id),j=await response.json();
   if(b.action==='parts_pickup'&&response.ok)ticket=j.data;
   if(!response.ok)failed.push({action:b.action,status:response.status,error:j.error});
   if(response.ok&&b.action==='update'&&p.flow_action==='complete'&&loseCompletion){loseCompletion=false;return route.abort();}
   if(response.ok&&b.action==='payment'&&losePayment){losePayment=false;return route.abort();}
   return route.fulfill({status:response.status,headers,json:j});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const current=async()=> (await h.call('get',{kind:'repair',id:initial.id})).record;
  const chooseMaster=async()=>{await page.locator('#dialog[open] select[name=assigned_master_id]').selectOption(masterId);await page.locator('#dialog button[type=submit]').click();await page.locator('#dialog[open]').waitFor({state:'hidden'});};
  const settled=()=>page.waitForFunction(()=>!document.querySelector('#rs-retry')&&!document.querySelector('[data-price]:disabled'));
  try{
   await page.goto(base+'/workshop.html#order?kind=repair&id='+initial.id);await page.locator('#rs-start').click();await page.locator('#rs-work-search').waitFor();
   await page.locator('[data-service]').first().click();await page.locator('[data-price]').waitFor();await settled();assert.equal((await current()).status,'repair');
   await page.locator('[data-price]').fill('1500.50');await page.locator('#rs-save').click();await settled();assert.equal((await current()).total_amount,1500.5);
   await page.locator('[data-step=parts]').click();
   if(withParts){
    await page.locator('#rs-order-part').click();await page.locator('#dialog [name=waiting_part]').fill('Тормозной трос');await page.locator('#dialog [name=waiting_due]').fill('2026-11-10');await page.locator('#dialog button[type=submit]').click();await page.locator('#dialog[open]').waitFor({state:'hidden'});
    await page.locator('#rs-take').click();
    if(role==='owner'){
     await page.locator('#dialog[open] select[name=assigned_master_id]').waitFor();assert.equal(h.requests.filter(x=>x.action==='parts_pickup').length,0);
     await page.locator('#dialog [data-close]').first().click();assert.equal((await current()).assigned_master_id,'');
     await page.locator('#rs-take').click();await chooseMaster();
    }
    await page.locator('[data-pickup-qr] svg').waitFor();assert.equal((await current()).assigned_master_id,masterId);
    // Closing QR before a physical issue must retain the saved assignment and current revision.
    await page.getByRole('dialog',{name:'Взять запчасти',exact:true}).getByRole('button',{name:'Закрыть',exact:true}).click();
    await page.locator('#rs-take').click();await page.locator('[data-pickup-qr] svg').waitFor();
    const issueId=randomUUID();await h.issue(ticket.code,issueId);await h.issue(ticket.code,issueId);
    await page.locator('[data-pickup-qr]').waitFor({state:'detached',timeout:12000});assert.equal((await current()).status,'repair');
   }
   await page.locator('#rs-to-finish').click();await page.locator('#rs-comment').fill('Проверено на стенде. Тормоза работают.');await page.locator('#rs-quality').check();await page.locator('#rs-complete').click();
   if(role==='owner'&&!withParts)await chooseMaster();
   if(role==='mechanic'&&withParts){await page.locator('#rs-retry').waitFor();await page.reload();await page.locator('#rs-retry').click();await page.locator('#rs-retry').waitFor({state:'detached'});await page.locator('[data-step=finish]').click();}
   await page.getByRole('link',{name:'Акт выполненных работ',exact:true}).waitFor();assert.equal((await current()).status,'ready');assert.equal(jobs.size,1);
   if(role==='mechanic'){assert.equal(await page.locator('#rs-cash').count(),0);await page.evaluate(id=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({user_id:id,access_token:'fixture-'+id,expires_at:4102444800})),ownerId);await page.reload();await page.locator('[data-step=finish]').click();}
   await page.locator('#rs-cash').click();await page.locator('#rs-pay').click();await page.locator('#dialog [name=method]').selectOption(withParts?'card':'cash');await page.locator('#dialog button[type=submit]').click();
   if(role==='owner'&&withParts){await page.locator('#modal-error .error').waitFor();await page.locator('#dialog button[type=submit]').click();}
   await page.locator('#dialog[open]').waitFor({state:'hidden'});await page.locator('#rs-handover:not([disabled])').waitFor();await page.locator('#rs-handover').click();await page.locator('#dialog button[type=submit]').click();await page.locator('#dialog[open]').waitFor({state:'hidden'});
   await page.getByRole('link',{name:'Акт выдачи',exact:true}).waitFor();const saved=await current();assert.equal(saved.status,'issued');assert.equal(saved.assigned_master_id,masterId);assert.equal(saved.paid_amount,withParts?2250.5:1500.5);
   assert.equal(h.sheets['Оплаты'].rows.length,1);assert.equal(h.sheets['Движения склада'].rows.length,withParts?1:0);assert.equal(jobs.size,1);assert.deepEqual(failed,[]);assert.deepEqual(errors,[]);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
   fs.mkdirSync('browser-results',{recursive:true});await page.screenshot({path:`browser-results/repair-full-${name}-${role}-${withParts?'parts':'no-parts'}-${width}.png`,fullPage:true});
   console.log(`PASS ${name} ${width} ${role} ${withParts?'parts':'no-parts'}: real API, assignment, repair, payment, handover, no duplicate writes`);
  }catch(e){console.error(JSON.stringify({name,width,role,withParts,errors,failed,body:(await page.locator('body').innerText()).slice(-2000)}));throw e;}finally{await context.close();}
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
