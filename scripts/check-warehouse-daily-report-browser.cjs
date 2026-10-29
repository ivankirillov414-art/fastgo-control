const playwright=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
const apiURL='https://oqgpjfikjpcplnxueoki.supabase.co/functions/v1/fastgo-warehouse';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const sheet=rows=>({rows});
const payment=(id,date,method,amount)=>({payment_id:id,'Дата':date,'Способ оплаты':method,'Сумма':amount,'Тип':'repair',record_id:id});
const sheets={'Оплаты':sheet([
 ...Array.from({length:105},(_,i)=>payment('history-'+i,'2026-10-25T07:00:00Z','cash',1)),
 payment('before','2026-10-27T18:59:59.999Z','cash',1000),
 payment('start','2026-10-27T19:00:00.000Z','cash',100.1),
 payment('transfer','2026-10-28T07:00:00.000Z','transfer',20),
 payment('end','2026-10-28T18:59:59.999Z','card',30.2),
 payment('tomorrow','2026-10-28T19:00:00.000Z','cash',400),
 payment('tomorrow-transfer','2026-10-29T07:00:00.000Z','transfer',50)
])};
const dateInputs=page=>({from:page.locator('[data-period] [name=from]'),to:page.locator('[data-period] [name=to]')});
async function settled(page,count){await page.waitForFunction(count=>document.querySelector('[data-count]')?.textContent==='Операций: '+count,count);}
async function selectDate(page,date){const fields=dateInputs(page);await fields.from.fill(date);await fields.to.fill(date);await page.getByRole('button',{name:'Показать',exact:true}).click();}

(async()=>{
 const kind=process.argv[2]||'chromium',{server,base}=await serve(),browser=await playwright[kind].launch(kind==='chromium'?launchOptions:{headless:true});
 const {finalReport}=await import(pathToFileURL(path.resolve(__dirname,'../supabase/functions/fastgo-warehouse/final-report.js')));
 const contexts=[];
 async function open({time='2026-10-28T18:58:00Z',timezoneId='Asia/Yekaterinburg',width=1366}={}){
  const context=await browser.newContext({timezoneId,viewport:{width,height:768}});context.setDefaultTimeout(15000);contexts.push(context);
  const api=backend(),requests=[],errors=[],state={};await api.connect(context,false);
  await context.route(apiURL,async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({headers,body:''});
   const p=route.request().postDataJSON();if(p.action!=='final_report')return route.fallback();
   requests.push(structuredClone(p));
   if(state.holdNext){state.holdNext=false;await new Promise(resolve=>state.release=resolve);}
   if(state.failNext){state.failNext=false;return route.fulfill({status:503,headers,json:{error:'Проверка недоступного отчёта'}});}
   try{return await route.fulfill({headers,json:{data:finalReport(sheets,p)}});}
   catch(e){return route.fulfill({status:400,headers,json:{error:e.message}});}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date(time)});await page.goto(base+'/warehouse.html');await page.locator('#final-report').click();
  return {context,page,requests,errors,state};
 }
 try{
  const {context,page,requests,errors,state}=await open();const fields=dateInputs(page);
  await settled(page,3);
  assert.equal(await fields.from.inputValue(),'2026-10-28');assert.equal(await fields.to.inputValue(),'2026-10-28');
  assert.equal(requests.at(-1).from,'2026-10-27T19:00:00.000Z');assert.equal(requests.at(-1).to,'2026-10-28T19:00:00.000Z');
  assert.equal(await page.locator('[data-grand-total]').innerText(),'150,30 ₽');
  assert.match(await page.locator('[data-report-period]').innerText(),/Сегодня.*28\.10\.2026/);
  await page.locator('details[data-method=cash] summary').click();
  assert.equal(await page.locator('.report-operation').count(),3);
  assert.equal(await page.getByText('Ремонт № before',{exact:true}).count(),0);
  await page.clock.fastForward(120500);await settled(page,2);
  assert.equal(await fields.from.inputValue(),'2026-10-29');assert.equal(await fields.to.inputValue(),'2026-10-29');
  assert.equal(await page.locator('[data-grand-total]').innerText(),'450,00 ₽');
  assert.equal(await page.getByText('Ремонт № start',{exact:true}).count(),0);
  assert.equal(await page.locator('details[data-method=cash]').getAttribute('open'),'');
  fs.mkdirSync('browser-results',{recursive:true});await page.screenshot({path:'browser-results/daily-report-'+kind+'-midnight.png'});
  console.log('PASS '+kind+': local midnight changes both dates, totals and operations; exclusive local bounds');

  await page.locator('[data-yesterday]').click();await settled(page,3);
  const beforeHistory=requests.length;
  await page.clock.setSystemTime(new Date('2026-10-29T19:00:10Z'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await fields.from.inputValue(),'2026-10-28');assert.equal(requests.length,beforeHistory);
  await page.locator('[data-all]').click();await settled(page,111);
  assert.equal(await fields.from.inputValue(),'');assert.equal(await fields.to.inputValue(),'');
  assert.equal(requests.at(-1).from,undefined);assert.equal(requests.at(-1).to,undefined);
  assert.equal(await page.locator('[data-grand-total]').innerText(),'1 705,30 ₽');
  await page.locator('[data-today]').click();await settled(page,0);
  assert.equal(await fields.from.inputValue(),'2026-10-30');assert.equal(await page.locator('[data-grand-total]').innerText(),'0,00 ₽');
  console.log('PASS '+kind+': yesterday, historical selection, all-time and empty current day');

  await selectDate(page,'2026-10-25');await settled(page,105);
  await fields.from.fill('2026-10-26');await fields.to.fill('2026-10-26');
  await page.locator('[data-more=cash]').click();
  await page.waitForFunction(()=>document.querySelectorAll('details[data-method=cash] .report-operation').length===105);
  assert.equal(requests.at(-1).from,'2026-10-24T19:00:00.000Z');assert.equal(requests.at(-1).offset,100);
  assert.equal(await fields.from.inputValue(),'2026-10-26');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await fields.from.inputValue(),'2026-10-26');
  console.log('PASS '+kind+': pagination stays in the displayed period while dates are being edited');

  state.holdNext=true;await page.locator('[data-yesterday]').click();
  while(!state.release)await new Promise(resolve=>setTimeout(resolve,10));
  await page.locator('[data-today]').click();await settled(page,0);
  state.release();delete state.release;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await fields.from.inputValue(),'2026-10-30');assert.equal(await page.locator('[data-grand-total]').innerText(),'0,00 ₽');

  await page.clock.setSystemTime(new Date('2026-10-28T07:00:00Z'));
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await settled(page,3);
  state.failNext=true;await page.clock.setSystemTime(new Date('2026-10-29T07:00:00Z'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Отчёт не загружен: Проверка недоступного отчёта',{exact:true}).waitFor();
  assert.equal(await fields.from.inputValue(),'2026-10-29');assert.equal(await page.locator('[data-grand-total]').innerText(),'—');
  assert.equal(await page.locator('.report-operation').count(),0);
  await page.locator('[data-refresh]').click();await settled(page,2);
  await page.locator('#back').click();const beforeDispose=requests.length;
  await page.clock.setSystemTime(new Date('2026-10-30T07:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.clock.fastForward(61000);assert.equal(requests.length,beforeDispose);assert.deepEqual(errors,[]);
  console.log('PASS '+kind+': sleep/resume, stale response, failed rollover and unmount cleanup');
  await context.close();

  for(const sample of [
   {timezoneId:'Asia/Yekaterinburg',time:'2026-12-31T18:58:00Z',date:'2026-12-31',next:'2027-01-01',hours:24,width:1024},
   {timezoneId:'Asia/Yekaterinburg',time:'2028-02-28T18:58:00Z',date:'2028-02-28',next:'2028-02-29',hours:24,width:390},
   {timezoneId:'Europe/Berlin',time:'2026-03-29T12:00:00Z',date:'2026-03-29',hours:23,width:320},
   {timezoneId:'America/New_York',time:'2026-11-01T17:00:00Z',date:'2026-11-01',hours:25,width:1366}
  ]){
   const x=await open(sample);await settled(x.page,0);
   assert.equal(await dateInputs(x.page).from.inputValue(),sample.date);
   const request=x.requests.at(-1);assert.equal((Date.parse(request.to)-Date.parse(request.from))/3600000,sample.hours);
   assert(await x.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(sample.next){await x.page.clock.fastForward(120500);await settled(x.page,0);await x.page.waitForFunction(date=>document.querySelector('[name=from]').value===date,sample.next);}
   fs.mkdirSync('browser-results',{recursive:true});await x.page.screenshot({path:'browser-results/daily-report-'+kind+'-'+sample.width+'.png'});
   assert.deepEqual(x.errors,[]);await x.context.close();
   console.log('PASS '+kind+': '+sample.timezoneId+' '+sample.date+', '+sample.hours+' hours, '+sample.width+'px'+(sample.next?' rollover '+sample.next:''));
  }
 }finally{for(const context of contexts)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
