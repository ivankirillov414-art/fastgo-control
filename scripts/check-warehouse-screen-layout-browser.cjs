const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve,backend,launchOptions}=require('./warehouse-browser-fixture.cjs');
(async()=>{const {server,base}=await serve();let browser;try{
 browser=await chromium.launch(launchOptions);
 for(const target of ['web','standalone','unified'])for(const [width,height] of [[1366,768],[850,600],[390,844]]){
  const unified=target==='unified',native=target!=='web',api=backend(),context=await browser.newContext({viewport:{width,height}});await api.connect(context,false,{unified});let ack=false;
  await context.addInitScript(native=>{if(native)document.addEventListener('DOMContentLoaded',()=>document.body.classList.add('warehouse-native-window'));window.warehouseDesktop={printReceiptLabels:async()=>({printed:true}),desktopStatus:async()=>({version:'1.0.39',usb:{status:'Подключите выбранный iData кабелем',pending:6},update:{status:'error',error:'Не удалось скачать обновление: проверяем восстановление соединения с сервером'},recovery:{status:'current',media_present:82,media_expected:82}})};},native);
  await context.route('**/functions/v1/fastgo-warehouse',async route=>{
   const p=route.request().postDataJSON()||{},headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
   if(p.action==='receipt_label_jobs')return route.fulfill({headers,json:{data:ack?[]:[{id:'layout-print',payload:{kind:'labels'},result:{items:[{name:'Амортизатор',barcode:'FGP-00000036',retail_price:1500,quantity:1}]}}]}});
   if(p.action==='receipt_label_ack'){ack=true;return route.fulfill({headers,json:{data:true}});}return route.fallback();
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);await page.goto(base+'/warehouse.html'+(unified?'?unified=1':''));await page.locator('#receipt').waitFor();
  await page.locator('#receipt-label-notice').waitFor();assert(ack);
  async function fits(selector){const box=await page.locator(selector).boundingBox();assert(box,selector);assert(box.x>=0&&box.x+box.width<=width+1,selector+' outside viewport '+JSON.stringify(box));if(width>700){const side=await page.locator('.warehouse-sidebar').boundingBox();assert(box.x>=side.x+side.width-1,selector+' under sidebar');}}
  await fits('#receipt-label-notice');await fits('#desktop-status');assert.equal(await page.locator('header .fg-notice-bell').count(),1,'notification bell belongs in header');fs.mkdirSync('browser-results',{recursive:true});if(width===850)await page.screenshot({path:'browser-results/'+target+'-notice-850.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');
  await page.locator('#nav-receipt').click();await page.locator('#live-back').waitFor();await page.waitForFunction(()=>document.getElementById('warehouse-section').textContent==='Приход');assert.equal(await page.locator('#nav-receipt').getAttribute('class'),'active');await fits('.live-heading');
  assert.equal(await page.locator('#receipt-label-notice').count(),0,'print notice must clear on navigation');
  await page.locator('#nav-pay').click();await page.waitForFunction(()=>document.getElementById('warehouse-section').textContent==='Оплата');assert.equal(await page.locator('#nav-pay').getAttribute('class'),'active');await fits('.live-heading');if(width===850)await page.screenshot({path:'browser-results/'+target+'-payment-850.png'});
  await page.locator('#back').click();await page.locator('#receipt').waitFor();await page.locator('#shift').click();await page.locator('#shift-form').waitFor();await fits('#shift-form');
  await page.locator('#master-stock').click();await page.getByRole('heading',{name:'Запчасти на мастерах'}).waitFor();await fits('.tablewrap');
  fs.mkdirSync('browser-results',{recursive:true});await page.screenshot({path:'browser-results/screen-layout-'+target+'-'+width+'.png'});
  await context.close();console.log('PASS: '+target+' '+width+'x'+height+' notices, gutters, navigation and no overflow');
 }
 }finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
