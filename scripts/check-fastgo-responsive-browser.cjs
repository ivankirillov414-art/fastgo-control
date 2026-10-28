const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium,firefox,webkit}=require('playwright');
const {serve,backend,launchOptions,scan}=require('./warehouse-browser-fixture.cjs');
const root=path.resolve(__dirname,'..'),kind=process.argv[2]||'chromium',baseline=process.argv.includes('--baseline'),source=process.argv.includes('--source');
const out=path.join(root,'browser-results','responsive',kind,baseline?'before':'after');fs.mkdirSync(out,{recursive:true});
const sizes=[[320,568],[360,800],[390,844],[430,932],[600,900],[768,1024],[820,1180],[1024,768],[1366,768]];
const results=[],failures=[],pageErrors=[];
const progress=label=>{if(process.env.RESPONSIVE_DEBUG)console.log(kind+': '+label);};
function check(ok,label,details){results.push({label,ok,...details});if(!ok)failures.push({label,...details});}
const headFile=name=>execFileSync('git',['show','HEAD:'+name],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
async function assets(context){
 if(baseline){
  for(const name of ['workshop.css','warehouse/style.css','workshop/repair-card.css','workshop/app.js','warehouse/app-compat.js','warehouse/web-version.json']){
   const body=headFile(name);await context.route('**/'+name+'*',route=>route.fulfill({contentType:name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/javascript',body}));
  }
 }else if(source){
  await context.route('**/warehouse/app-compat.js*',route=>route.fulfill({contentType:'text/javascript',body:"import('./app.js').catch(error=>{console.error(error);throw error;})"}));
  const body=fs.readFileSync(path.join(root,'warehouse-desktop/update-clock.cjs'),'utf8').replace('module.exports={createDailyCheck};','export {createDailyCheck};');
  await context.route('**/warehouse-desktop/update-clock.cjs',route=>route.fulfill({contentType:'text/javascript',body}));
 }
}
async function visit(page,url){await page.goto(url,{waitUntil:'domcontentloaded'});}
async function pageErrorsOn(page){page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(45000);page.on('pageerror',e=>pageErrors.push(e.message));}
async function pageFits(page,label,details){const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));check(geometry.scrollWidth<=geometry.width+1,label,{...details,...geometry});}
async function boxInside(page,selector,height,label,details){
 const geometry=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth};});
 check(geometry.left>=-1&&geometry.top>=-1&&geometry.right<=geometry.width+1&&geometry.bottom<=height+1,label,{...details,...geometry});
}
async function clickableWithoutScrolling(page,selector,label,details){
 const hit=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {visible:r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&!!hit&&(el===hit||el.contains(hit)),x,y};});
 check(hit.visible,label,{...details,...hit});
}
async function fakeViewport(context){await context.addInitScript(()=>{const viewport=new EventTarget();Object.assign(viewport,{width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});window.__responsiveViewport=viewport;});}
async function setVisualHeight(page,height){await page.evaluate(h=>{window.__responsiveViewport.height=h;window.__responsiveViewport.dispatchEvent(new Event('resize'));},height);if(baseline)await page.waitForTimeout(80);else await page.waitForFunction(h=>document.documentElement.style.getPropertyValue('--fastgo-viewport-height')===h+'px',height);}
async function workshopContext(browser,base,{role='owner',fake=false,session=true}={}){
 const context=await browser.newContext({viewport:{width:390,height:844}});await assets(context);if(fake)await fakeViewport(context);
 if(session)await context.addInitScript(()=>localStorage.setItem('fastgo_workshop_session',JSON.stringify({access_token:'responsive-fixture',user_id:'responsive-fixture',expires_at:4102444800})));
 const record={id:'responsive-repair',repair_number:1001,status:'repair',revision:1,brand:'Kugoo',model:'Max Speed',last_name:'Демонстрационный',first_name:'Клиент',phone:'+79990000000',created_at:'2026-10-27',master_id:'responsive-fixture',storage_amount:0,paid_amount:0,total_amount:1500,fault_photo_paths:[],signed_document_paths:[],works:[],parts:[]};
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url();if(url.startsWith(base)||/^(blob:|data:)/.test(url))return route.continue();
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.includes('/functions/v1/fastgo-print-api'))return route.fulfill({headers,json:{data:{enabled:false}}});
  if(url.includes('/functions/v1/fastgo-avito'))return route.fulfill({headers,json:{data:{connected:false,owner:role==='owner',notifications:[],popups_allowed:false}}});
  if(!url.includes('/functions/v1/fastgo-workshop-api'))return route.abort();
  const {action}=req.postDataJSON()||{};
  const data=({me:{role,name:'Демонстрационный сотрудник',profile_id:'responsive-fixture',active:true,backend:'POSTGRES_GOOGLE_MIRROR'},request_access:{active:true},catalog:{services:[{id:'s1',title:'Электрическая диагностика',labor_price:1500}],staff:[],parts:[],categories:[]},list:{count:1,items:[record]},get:{record,events:[],payments:[],linked:[],legal:{}},overview:{repairs:1,ready:0,overdue:0,storage:0,storage_due:0,debt:0,today_payments:0},legal:{legal_name:'Демонстрация'},health:{capabilities:{}}})[action]||{};
  return route.fulfill({headers,json:{data}});
 });return context;
}
(async()=>{const {server,base}=await serve();let browser;try{
 browser=await ({chromium,firefox,webkit})[kind].launch(kind==='chromium'?launchOptions:{headless:true});
 progress('warehouse matrix');
 // Phone/tablet/desktop warehouse list and product card, with real fixture auth.
 {
  const api=backend(),context=await browser.newContext();await api.connect(context,false,{readonly:true});await assets(context);const page=await context.newPage();await pageErrorsOn(page);
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});await visit(page,base+'/warehouse.html');await page.locator('#stock-list').waitFor();await pageFits(page,'warehouse-page',{width,height});
   const clipped=await page.locator('.inventory-item').first().evaluate(el=>{const row=el.getBoundingClientRect();return [...el.children].map(c=>{const r=c.getBoundingClientRect();return {text:c.textContent,right:r.right,rowRight:row.right};}).filter(x=>x.right>x.rowRight+1);});
   check(!clipped.length,'inventory-price-not-clipped',{width,height,clipped});
   if(width>700){const header=await page.locator('header').boundingBox(),button=await page.locator('.warehouse-sidebar #back').boundingBox();check(button.y>=header.y+header.height-1,'tablet-navigation-below-wrapped-header',{width,height,headerBottom:header.y+header.height,navTop:button.y});}
   if(width===320){await page.screenshot({path:path.join(out,'warehouse-320.png')});await page.locator('.inventory-table').screenshot({path:path.join(out,'inventory-320.png')});}
   await page.locator('.inventory-item').first().click();await boxInside(page,'.product-dialog',height,'product-dialog-in-viewport',{width,height});
   await page.locator('.product-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await clickableWithoutScrolling(page,'.product-dialog [data-close]','product-close-after-scroll',{width,height});
   if(width===320||width===1366){
    const geometry=await page.locator('.product-dialog').evaluate(el=>{const error=el.querySelector('.product-error');error.textContent='Не удалось загрузить фотографию. Повторите попытку после восстановления связи.';const r=error.getBoundingClientRect(),bounds=el.getBoundingClientRect(),main=el.querySelector('.product-main').getBoundingClientRect(),photos=el.querySelector('.product-photos').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,mainBottom:main.bottom,photosBottom:photos.bottom,dialogLeft:bounds.left,dialogRight:bounds.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};});
    check(geometry.left>=geometry.dialogLeft&&geometry.right<=geometry.dialogRight&&geometry.scrollWidth<=geometry.clientWidth+1&&geometry.top>=Math.max(geometry.mainBottom,geometry.photosBottom)-1,'product-error-below-columns',{width,height,...geometry});await page.locator('.product-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await clickableWithoutScrolling(page,'.product-dialog .product-error','product-error-visible',{width,height});if(width===1366)await page.screenshot({path:path.join(out,'product-error-1366.png')});
   }
   if(width===320)await page.screenshot({path:path.join(out,'product-scrolled-320.png')});await page.keyboard.press('Escape');
  }
  // Platform system fonts have different minimum text widths (Linux CI caught this).
  for(const width of [320,360]){
   await page.setViewportSize({width,height:568});await visit(page,base+'/warehouse.html');await page.locator('.inventory-item').first().click();
   for(const family of ['Verdana','Tahoma','monospace']){
    const geometry=await page.locator('.product-dialog').evaluate((el,family)=>{el.style.fontFamily=family;el.querySelector('.product-error').textContent='Не удалось загрузить фотографию. Повторите попытку после восстановления связи.';const metrics=el.querySelector('.product-metrics');return {scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,metricsScrollWidth:metrics.scrollWidth,metricsClientWidth:metrics.clientWidth};},family);
    check(geometry.scrollWidth<=geometry.clientWidth+1&&geometry.metricsScrollWidth<=geometry.metricsClientWidth+1,'narrow-product-platform-font',{width,height:568,family,...geometry});
   }
   await page.keyboard.press('Escape');
  }
  await context.close();
 }
 progress('keyboard and native caption');
 // Constrained visual viewport models a keyboard while the layout viewport stays tall.
 {
  const api=backend(),context=await browser.newContext({viewport:{width:390,height:844}});await api.connect(context,false,{readonly:true});await assets(context);await fakeViewport(context);const page=await context.newPage();await pageErrorsOn(page);
  await visit(page,base+'/warehouse.html');await page.locator('.inventory-item').first().click();await page.getByRole('button',{name:'Изменить закупочную цену',exact:true}).click();await setVisualHeight(page,360);
  await boxInside(page,'.product-dialog',360,'product-dialog-above-keyboard',{width:390,height:360});await boxInside(page,'.metric-editor input',360,'product-editor-above-keyboard',{width:390,height:360});await boxInside(page,'.metric-editor [type=submit]',360,'product-save-above-keyboard',{width:390,height:360});await page.screenshot({path:path.join(out,'product-keyboard-390.png')});await page.locator('.product-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await clickableWithoutScrolling(page,'.product-dialog [data-close]','product-close-with-keyboard',{width:390,height:360});await page.keyboard.press('Escape');await setVisualHeight(page,844);
  await page.getByRole('button',{name:'Добавить запчасть',exact:true}).click();await setVisualHeight(page,360);await boxInside(page,'.new-part-dialog',360,'new-part-dialog-above-keyboard',{width:390,height:360});await page.locator('.new-part-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await boxInside(page,'.new-part-dialog [data-product-next]',360,'new-part-next-reachable',{width:390,height:360});
  await page.evaluate(()=>{window.__responsiveViewport.scale=2;window.__responsiveViewport.dispatchEvent(new Event('resize'));});await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-fastgo-visual-constrained'));check(await page.evaluate(()=>!document.documentElement.hasAttribute('data-fastgo-visual-constrained')),'pinch-zoom-not-keyboard',{});await context.close();
 }
 // Real native caption reserve stays unchanged when the browser window is short.
 {
  const api=backend(),context=await browser.newContext();await api.connect(context,false);await assets(context);await context.addInitScript(()=>{window.addEventListener('DOMContentLoaded',()=>document.body.classList.add('warehouse-native-window'));window.warehouseDesktop={desktopStatus:async()=>({version:'1.0.39',usb:{status:'Готов',pending:0},update:{status:'current'}})};});const page=await context.newPage();await pageErrorsOn(page);await visit(page,base+'/warehouse.html');await page.locator('#receipt').waitFor();
  for(const width of [850,1000,1250,1366]){await page.setViewportSize({width,height:600});const header=await page.locator('header').boundingBox();check(header.height===64&&header.y===0,'native-caption-height',{width,header});for(const selector of ['#usb-scanner','#logout']){const r=await page.locator(selector).boundingBox();check(r.x+r.width<=width-148,'native-caption-reserve',{width,selector,right:r.x+r.width});}await pageFits(page,'native-page',{width,height:600});}await context.close();
 }
 progress('service matrix');
 // Service list/intake/repair use their actual role-aware renderers.
 for(const role of ['owner','mechanic']){
  const context=await workshopContext(browser,base,{role}),page=await context.newPage();await pageErrorsOn(page);
  for(const [width,height] of sizes){await page.setViewportSize({width,height});await visit(page,base+'/workshop.html#repairs');await page.locator('.records').waitFor();await pageFits(page,'service-list',{role,width,height});check(await page.locator('.view-switch,.order-board').count()===0,'table-only-no-selector',{role,width});}
  if(role==='owner'){await page.setViewportSize({width:320,height:568});await visit(page,base+'/workshop.html#new?kind=repair');await page.locator('#intake-form').waitFor();await pageFits(page,'service-intake',{width:320,height:568});}
  await visit(page,base+'/workshop.html#order?kind=repair&id=responsive-repair');await page.locator('.repair-steps').waitFor();for(const [width,height] of sizes){await page.setViewportSize({width,height});if(width<=760){for(const pane of ['card','works','parts','finish']){await page.locator('[data-step="'+pane+'"]').click();await pageFits(page,'repair-pane',{role,pane,width,height});}}else await pageFits(page,'repair-desktop',{role,width,height});if(width===390)await page.screenshot({path:path.join(out,'repair-'+role+'-390.png')});}
  if(role==='mechanic')check(await page.locator('#payment,#refund,#warehouse-service').count()===0,'master-no-payment-actions',{role});await context.close();
 }
 progress('touch and legacy viewport');
 // Touch layouts use the same real screens; CSS-pixel geometry also holds at DPR2.
 for(const [width,height] of [[390,844],[820,1180],[1024,768]]){
  const api=backend(),context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,hasTouch:true,...(kind==='firefox'?{}:{isMobile:true})});await api.connect(context,false,{readonly:true});await assets(context);const page=await context.newPage();await pageErrorsOn(page);await visit(page,base+'/warehouse.html');await page.locator('.inventory-item').first().tap();await boxInside(page,'.product-dialog',height,'touch-product-in-viewport',{width,height,dpr:2});await page.locator('.product-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);await clickableWithoutScrolling(page,'.product-dialog [data-close]','touch-product-close',{width,height});await context.close();
 }
 // Older WebViews without visualViewport retain the innerHeight fallback.
 {
  const api=backend(),context=await browser.newContext({viewport:{width:360,height:480}});await api.connect(context,false,{readonly:true});await assets(context);await context.addInitScript(()=>Object.defineProperty(window,'visualViewport',{configurable:true,value:undefined}));const page=await context.newPage();await pageErrorsOn(page);await visit(page,base+'/warehouse.html');await page.locator('.inventory-item').first().click();await boxInside(page,'.product-dialog',480,'legacy-viewport-dialog',{width:360,height:480});await context.close();
 }
 if(!baseline){
  const context=await browser.newContext(),page=await context.newPage();await visit(page,base+'/workshop/viewport-layout.js');
  const lifecycle=await page.evaluate(async()=>{
   const {installViewportLayout}=await import('/workshop/viewport-layout.js'),first=installViewportLayout(),same=installViewportLayout()===first;
   const nativeRequest=window.requestAnimationFrame.bind(window);let scheduled=0;
   window.requestAnimationFrame=callback=>{scheduled++;return nativeRequest(callback);};
   try{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('orientationchange'));const coalesced=scheduled;installViewportLayout();first();first();window.dispatchEvent(new Event('resize'));const afterDispose=scheduled;await new Promise(nativeRequest);return {same,coalesced,afterDispose};}finally{window.requestAnimationFrame=nativeRequest;}
  });check(lifecycle.same&&lifecycle.coalesced===1&&lifecycle.afterDispose===1,'viewport-singleton-coalescing-cleanup',lifecycle);await context.close();
 }
 {
  const context=await workshopContext(browser,base,{fake:true}),page=await context.newPage();await pageErrorsOn(page);await visit(page,base+'/workshop.html#order?kind=repair&id=responsive-repair');await page.locator('[data-step=works]').click();await setVisualHeight(page,360);await boxInside(page,'.rs-bottom',360,'repair-save-above-keyboard',{width:390,height:360});await page.screenshot({path:path.join(out,'repair-keyboard-390.png')});await context.close();
 }
 progress('TSD fallback');
 // Web TSD fallback: home and scanned receipt remain reachable in a 320x480 viewport.
 {
  const api=backend(),context=await browser.newContext({viewport:{width:320,height:480}});await api.connect(context,true);await assets(context);const page=await context.newPage();await pageErrorsOn(page);await visit(page,base+'/warehouse-terminal.html');await page.locator('#receipt').waitFor();await pageFits(page,'tsd-home',{width:320,height:480});await page.locator('#receipt').click();await scan(page);await page.locator('.last-scan').waitFor();await pageFits(page,'tsd-receipt',{width:320,height:480});await page.screenshot({path:path.join(out,'tsd-receipt-320.png')});await context.close();
 }
 check(pageErrors.length===0,'no-browser-errors',{errors:pageErrors});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:kind,mode:baseline?'baseline':source?'source':'bundled',checks:results.length,failures,results},null,2));
 console.log(JSON.stringify({browser:kind,mode:baseline?'baseline':source?'source':'bundled',checks:results.length,failures:failures.length,details:failures}));if(!baseline)assert.equal(failures.length,0,'responsive regressions: '+JSON.stringify(failures));
 }finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
