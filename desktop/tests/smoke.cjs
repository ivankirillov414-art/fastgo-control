const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const {Store}=require('../store.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-desktop-smoke-')),actor='11111111-1111-4111-8111-111111111111';
const store=new Store(path.join(data,'FastGo.sqlite'));
for(const [key,value] of Object.entries({request_access:{active:true},me:{profile_id:actor,role:'owner',name:'Тест',can_sell:true,can_edit_catalog:true,status_permissions:{can_mark_ready:true,can_issue:true,can_cancel:true}},catalog:{services:[{id:'33333333-3333-4333-8333-333333333333',title:'Замена камеры',labor_price:500,active:true}],works:[],parts:[],staff:[{id:'22222222-2222-4222-8222-222222222222',name:'Алексей Иванов',role:'mechanic',active:true}],categories:[]},legal:{legal_name:'FastGo'}}))store.cache(actor,key,value);
store.close();
const wrapper=path.join(data,'launch.cjs');fs.writeFileSync(wrapper,`const {app,net,safeStorage}=require('electron');const fs=require('node:fs'),path=require('node:path');app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>false;app.whenReady().then(()=>fs.writeFileSync(path.join(app.getPath('userData'),'credentials.bin'),safeStorage.encryptString(JSON.stringify({access_token:'offline-smoke-token',refresh_token:'offline-smoke-refresh',user_id:${JSON.stringify(actor)},expires_at:4102444800}))));require(${JSON.stringify(path.join(root,'main.cjs'))});`);
async function launch(){const app=await _electron.launch({executablePath:require('electron'),args:[wrapper],timeout:45000});const page=await app.firstWindow();page.on('pageerror',e=>console.error('Renderer:',e.message));await page.locator('#desktop-state-text').waitFor({state:'attached'});return {app,page};}
(async()=>{let opened=await launch();try{
 const launchVisibility=await opened.app.evaluate(({app,BrowserWindow})=>{
  const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('fastgo://app/workshop.html')),before=BrowserWindow.getAllWindows().length;
  window.hide();const hidden=!window.isVisible();
  app.emit('second-instance',{},[process.execPath,app.getAppPath(),'--background'],process.cwd());const quiet=!window.isVisible();
  app.emit('second-instance',{},[process.execPath,app.getAppPath()],process.cwd());const reopened=window.isVisible();
  app.emit('second-instance',{},[process.execPath,app.getAppPath(),'--background'],process.cwd());
  return {hidden,quiet,reopened,visibleWorkPreserved:window.isVisible(),sameWindows:BrowserWindow.getAllWindows().length===before};
 });assert.deepEqual(launchVisibility,{hidden:true,quiet:true,reopened:true,visibleWorkPreserved:true,sameWindows:true});
 const chrome=await opened.app.evaluate(({Menu,BrowserWindow})=>({menu:Menu.getApplicationMenu(),menuVisible:BrowserWindow.getAllWindows()[0].isMenuBarVisible()}));assert.equal(chrome.menu,null);assert.equal(chrome.menuVisible,false);
 await require('../../scripts/fullscreen-smoke.cjs')(opened);
 // The fullscreen probe exits to windowed mode before checking its native caption area.
 if(process.platform==='win32')await opened.page.waitForFunction(()=>{const r=navigator.windowControlsOverlay.getTitlebarAreaRect(),bar=document.querySelector('#desktop-status').getBoundingClientRect();return navigator.windowControlsOverlay.visible&&r.width>0&&bar.right<=r.width+1;});
 if(process.platform==='win32'){assert.equal(await opened.page.evaluate(()=>navigator.windowControlsOverlay.visible),true);const rect=await opened.page.evaluate(()=>{const r=navigator.windowControlsOverlay.getTitlebarAreaRect();const bar=document.querySelector('#desktop-status').getBoundingClientRect();return {width:r.width,barRight:bar.right};});assert.ok(rect.barRight<=rect.width+1);}
 await opened.page.waitForFunction(()=>document.querySelector('#desktop-state-text')?.textContent.includes('Работа без сети'));
 await opened.page.evaluate(()=>location.hash='#new?kind=repair');
 await opened.page.locator('#f-last_name').fill('Клиент');await opened.page.locator('#f-first_name').fill('Тест');await opened.page.locator('#f-phone').fill('79999999999');await opened.page.locator('#f-equipment_name').fill('Kugoo Max Speed');
 await opened.page.locator('#intake-save').click();await opened.page.waitForFunction(()=>location.hash.startsWith('#order?'),{},{timeout:45000});
 await opened.page.locator('h1').waitFor();assert.match(await opened.page.locator('h1').innerText(),/Kugoo/);await opened.page.waitForFunction(async()=> (await window.fastgoDesktop.state()).pending===1);
 assert(Array.isArray(await opened.page.evaluate(()=>window.fastgoDesktop.printers())));
 await opened.app.evaluate(({app,BrowserWindow})=>{globalThis.smokePrints=[];const install=contents=>{contents.getPrintersAsync=async()=>[{name:'FASTGO_SMOKE_PRINTER',displayName:'Smoke'}];contents.print=(options,callback)=>{globalThis.smokePrints.push(options);callback(true);};};for(const window of BrowserWindow.getAllWindows())install(window.webContents);app.on('web-contents-created',(_event,contents)=>install(contents));});
 await opened.page.evaluate(()=>window.fastgoDesktop.configure({printer:'FASTGO_SMOKE_PRINTER',remotePrint:false}));
 for(let i=0;i<40;i++){if((await opened.app.evaluate(()=>globalThis.smokePrints.length))===1)break;await opened.page.waitForTimeout(500);}
 const prints=await opened.app.evaluate(()=>globalThis.smokePrints);assert.equal(prints.length,1);assert.equal(prints[0].silent,true);assert.equal(prints[0].deviceName,'FASTGO_SMOKE_PRINTER');assert.equal(prints[0].pageSize,'A4');assert.deepEqual(prints[0].margins,{marginType:'custom',top:38,bottom:38,left:38,right:38});

 await opened.app.close();opened=await launch();await opened.page.evaluate(()=>location.hash='#repairs');await opened.page.getByText('Клиент Тест',{exact:false}).first().waitFor();
 const state=await opened.page.evaluate(()=>window.fastgoDesktop.state());assert.equal(state.records,1);assert.equal(state.pending,1);
 // The bundled Windows interface can save and advance an offline repair without stock parts.
 await opened.page.locator('[data-open-repair]').first().click();
 await opened.page.locator('#rs-start').waitFor();
 await opened.page.locator('#rs-master').selectOption('22222222-2222-4222-8222-222222222222');
 await opened.page.locator('#rs-start').click();await opened.page.locator('[data-service]').click();
 await opened.page.waitForFunction(()=>!document.querySelector('[data-price]')?.disabled);
 await opened.page.locator('[data-step=finish]').click();await opened.page.locator('#rs-comment').fill('Ремонт без складских деталей. Проверено.');
 await opened.page.locator('#rs-quality').check();await opened.page.locator('#rs-complete').click();
 await opened.page.waitForFunction(()=>document.querySelector('.rs-status')?.textContent==='Готово к выдаче');
 assert.equal(await opened.page.locator('#rs-quality,#rs-complete').count(),0);
 assert.equal((await opened.page.evaluate(()=>window.fastgoDesktop.state())).pending,4);
 console.log('PASS: Windows sandbox bridge, offline intake without photos, durable restart, document rendering and silent printer dispatch');
 }catch(e){console.error(await opened.page.locator('body').innerText());throw e;}finally{await opened.app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
