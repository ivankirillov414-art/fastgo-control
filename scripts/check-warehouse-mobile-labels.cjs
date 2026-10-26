const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve(),kind=process.argv[2]||'chromium',browser=await ({chromium,webkit})[kind].launch(kind==='chromium'?launchOptions:{headless:true});try{
 const api=backend(),phone=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),cash=await browser.newContext({viewport:{width:1280,height:800}}),requests=[],errors=[];api.state.parts[0].name='Амортизатор';
 await api.connect(phone,false,{readonly:true});await api.connect(cash,false);
 let loseReply=true;
 await phone.route('https://oqgpjfikjpcplnxueoki.supabase.co/**',async route=>{
  const r=route.request(),p=r.postDataJSON()||{},a=p.action,params=p.params,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
  if(a==='label_targets')return route.fulfill({headers,json:{data:[{id:'55555555-5555-4555-8555-555555555555',name:'Драгнир',printer:'P2 Label Printer',online:true}]}});
  if(a!=='label_enqueue')return route.fallback();requests.push(params);let job=api.jobs.get(params.request_id);
  if(!job){const part=api.state.parts.find(x=>x.id===params.part_id);job={id:params.request_id,state:'done',payload:{kind:'labels'},result:{label_print_status:'pending',items:[{...part,quantity:params.quantity}]}};api.jobs.set(job.id,job);}
  if(loseReply){loseReply=false;return route.abort();}
  return route.fulfill({headers,json:{data:{id:job.id,status:job.result.label_print_status}}});
 });
 await cash.addInitScript(()=>{window.labelSubmissions=[];window.warehouseDesktop={printReceiptLabels:async job=>{if(!window.labelSubmissions.some(x=>x.id===job.id))window.labelSubmissions.push(job);return {printed:true};}};});
 const page=await phone.newPage(),cashPage=await cash.newPage();page.on('pageerror',e=>errors.push(e.message));cashPage.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/warehouse.html');await page.locator('#stock-list').waitFor();await page.locator('.inventory-item').first().click();
 const card=page.locator('.product-dialog'),offer=page.getByRole('dialog',{name:'Напечатать этикетки?',exact:true});
 await card.getByRole('button',{name:'Изменить остаток',exact:true}).click();await card.getByLabel('Новый остаток',{exact:true}).fill('44');await card.getByRole('button',{name:'Сохранить',exact:true}).click();
 await offer.waitFor();assert.equal(await offer.locator('[name=quantity]').inputValue(),'44');assert.equal(api.state.edits.length,1);assert.equal(api.jobs.size,0,'saving stock never prints without confirmation');
 assert.equal(await offer.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'offer fits phone width');
 fs.mkdirSync(path.resolve(__dirname,'../browser-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../browser-results/'+kind+'-mobile-label-offer-44.png')});
 await offer.locator('[name=quantity]').fill('7');await offer.getByRole('button',{name:'Напечатать',exact:true}).click();await offer.getByRole('button',{name:'Повторить',exact:true}).waitFor();assert.equal(api.jobs.size,1);
 await offer.getByRole('button',{name:'Закрыть',exact:true}).click();await page.reload();await page.locator('.inventory-item').first().click();await card.getByRole('button',{name:'Печать штрихкодов',exact:true}).click();await offer.waitFor();assert.equal(await offer.locator('[name=quantity]').inputValue(),'7');assert.equal(await offer.locator('[name=quantity]').isDisabled(),true);
 await offer.getByRole('button',{name:'Напечатать',exact:true}).click();await offer.getByRole('button',{name:'Готово',exact:true}).waitFor();assert.equal(requests.length,2);assert.equal(requests[0].request_id,requests[1].request_id);assert.equal(api.jobs.size,1);assert.equal(api.state.edits.length,1);
 await cashPage.goto(base+'/warehouse.html');await cashPage.waitForFunction(()=>window.labelSubmissions.length===1);assert.equal((await cashPage.evaluate(()=>window.labelSubmissions[0])).items[0].quantity,7);assert.equal(api.state.parts[0].quantity,44,'labels do not change stock');
 await offer.getByRole('button',{name:'Готово',exact:true}).click();await card.getByRole('button',{name:'Изменить цену',exact:true}).click();await card.getByLabel('Новая цена',{exact:true}).fill('1201');await card.getByRole('button',{name:'Сохранить',exact:true}).click();await card.locator('[data-metric=retail_price] strong').filter({hasText:'1 201'}).waitFor();assert.equal(await offer.count(),0,'price-only edits do not offer stock labels');
 await card.getByRole('button',{name:'Изменить остаток',exact:true}).click();await card.getByLabel('Новый остаток',{exact:true}).fill('0');await card.getByRole('button',{name:'Сохранить',exact:true}).click();await card.locator('[data-metric=quantity] strong').filter({hasText:'0'}).waitFor();assert.equal(await offer.count(),0,'zero stock does not offer zero labels');await card.getByRole('button',{name:'Закрыть карточку',exact:true}).click();
 await page.getByRole('button',{name:'Добавить запчасть',exact:true}).click();const form=page.locator('.new-part-dialog');await form.locator('[name=name]').fill('Амортизатор новый');await form.locator('[name=category]').fill('Амортизаторы');await form.locator('[name=initial_quantity]').fill('44');await form.getByRole('button',{name:'Создать запчасть',exact:true}).click();await offer.waitFor();assert.equal(await offer.locator('[name=quantity]').inputValue(),'44');assert.equal(api.state.productSaves.length,1);assert.equal(api.state.stockIntakes.length,1);
 await offer.getByRole('button',{name:'Не печатать',exact:true}).click();assert.equal(api.jobs.size,1,'declining printing leaves no job');assert.deepEqual(errors,[]);
 console.log('PASS '+kind+': phone stock 44 → editable labels 44 → edited 7 → cash auto-print; lost reply/reload reuses one job; create 44, dismiss, price-only and zero-stock paths');
 }finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
