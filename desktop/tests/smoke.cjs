const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const {Store}=require('../store.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-desktop-smoke-')),actor='11111111-1111-4111-8111-111111111111';
const store=new Store(path.join(data,'FastGo.sqlite'));
for(const [key,value] of Object.entries({request_access:{active:true},me:{profile_id:actor,role:'owner',name:'Тест',can_sell:true,can_edit_catalog:true,status_permissions:{can_mark_ready:true,can_issue:true,can_cancel:true}},catalog:{services:[],works:[],parts:[],staff:[],categories:[]},legal:{legal_name:'FastGo'}}))store.cache(actor,key,value);
store.close();
const wrapper=path.join(data,'launch.cjs');fs.writeFileSync(wrapper,`const {app,net,safeStorage}=require('electron');const fs=require('node:fs'),path=require('node:path');app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>false;app.whenReady().then(()=>fs.writeFileSync(path.join(app.getPath('userData'),'credentials.bin'),safeStorage.encryptString(JSON.stringify({access_token:'offline-smoke-token',refresh_token:'offline-smoke-refresh',user_id:${JSON.stringify(actor)},expires_at:4102444800}))));require(${JSON.stringify(path.join(root,'main.cjs'))});`);
async function launch(){const app=await _electron.launch({executablePath:require('electron'),args:[wrapper],timeout:45000});const page=await app.firstWindow();page.on('pageerror',e=>console.error('Renderer:',e.message));await page.locator('#desktop-state-text').waitFor({state:'attached'});return {app,page};}
(async()=>{let opened=await launch();try{
 await opened.page.waitForFunction(()=>document.querySelector('#desktop-state-text')?.textContent.includes('Работа без сети'));
 await opened.page.evaluate(()=>location.hash='#new?kind=repair');
 await opened.page.locator('#f-last_name').fill('Клиент');await opened.page.locator('#f-first_name').fill('Тест');await opened.page.locator('#f-phone').fill('79999999999');await opened.page.locator('#f-equipment_name').fill('Kugoo Max Speed');await opened.page.locator('#f-intake_amount').fill('500');
 await opened.page.locator('#intake-save').click();await opened.page.waitForFunction(()=>location.hash.startsWith('#order?'),{},{timeout:45000});
 await opened.page.locator('h1').waitFor();assert.match(await opened.page.locator('h1').innerText(),/Ремонт/);await opened.page.waitForFunction(async()=> (await window.fastgoDesktop.state()).pending===2);
 assert(Array.isArray(await opened.page.evaluate(()=>window.fastgoDesktop.printers())));
 await opened.app.evaluate(({app,BrowserWindow})=>{globalThis.smokePrints=[];const install=contents=>{contents.getPrintersAsync=async()=>[{name:'FASTGO_SMOKE_PRINTER',displayName:'Smoke'}];contents.print=(options,callback)=>{globalThis.smokePrints.push(options);callback(true);};};for(const window of BrowserWindow.getAllWindows())install(window.webContents);app.on('web-contents-created',(_event,contents)=>install(contents));});
 await opened.page.evaluate(()=>window.fastgoDesktop.configure({printer:'FASTGO_SMOKE_PRINTER',remotePrint:false}));
 for(let i=0;i<40;i++){if((await opened.app.evaluate(()=>globalThis.smokePrints.length))===1)break;await opened.page.waitForTimeout(500);}
 const prints=await opened.app.evaluate(()=>globalThis.smokePrints);assert.equal(prints.length,1);assert.equal(prints[0].silent,true);assert.equal(prints[0].deviceName,'FASTGO_SMOKE_PRINTER');assert.equal(prints[0].pageSize,'A4');assert.deepEqual(prints[0].margins,{marginType:'custom',top:38,bottom:38,left:38,right:38});

 await opened.app.close();opened=await launch();await opened.page.evaluate(()=>location.hash='#repairs');await opened.page.getByText('Клиент Тест',{exact:false}).first().waitFor();
 const state=await opened.page.evaluate(()=>window.fastgoDesktop.state());assert.equal(state.records,1);assert.equal(state.pending,2);
 // The bundled Windows interface can save and advance an offline repair without stock parts.
 await opened.page.locator('.order-no').first().click();
 await opened.page.locator('#repair-progress-panel .compact-panel-trigger').click();
 assert.equal(await opened.page.locator('#f-status,#f-promised_date,#catalog-picker').count(),0);
 const save=async action=>{const form=await opened.page.locator('#order-form').elementHandle();await action();await opened.page.waitForFunction(form=>!form.isConnected,form);await opened.page.locator('#repair-save').waitFor();};
 await save(()=>opened.page.locator('#repair-save').click());
 await save(()=>opened.page.getByRole('button',{name:'Начать диагностику',exact:true}).click());
 await opened.page.getByRole('button',{name:'Начать ремонт',exact:true}).click();
 await opened.page.locator('#f-flow_diagnostics').fill('Прокол камеры, деталь клиента');
 await opened.page.locator('[name="flow_approved"]').check();await opened.page.locator('#f-flow_approval_note').fill('Согласовано');
 await save(()=>opened.page.locator('#modal-form button[type="submit"]').click());
 await opened.page.getByRole('button',{name:'Ремонт готов',exact:true}).click();await opened.page.locator('[name="flow_quality"]').check();
 await save(()=>opened.page.locator('#modal-form button[type="submit"]').click());
 assert.equal(await opened.page.locator('#part-rows .cost-row').count(),0);
 assert.match(await opened.page.locator('.order-detail-status').innerText(),/Готов/);
 console.log('PASS: Windows sandbox bridge, offline intake without photos, durable restart, document rendering and silent printer dispatch');
 }catch(e){console.error(await opened.page.locator('body').innerText());throw e;}finally{await opened.app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
