const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const {Store}=require('../store.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-update-ui-')),actor='11111111-1111-4111-8111-111111111111';
const store=new Store(path.join(data,'FastGo.sqlite'));
for(const [key,value] of Object.entries({request_access:{active:true},me:{profile_id:actor,role:'owner',name:'Тест',status_permissions:{can_mark_ready:true,can_issue:true,can_cancel:true}},catalog:{services:[],works:[],parts:[],staff:[],categories:[]}}))store.cache(actor,key,value);
store.close();
const wrapper=path.join(data,'launch.cjs');fs.writeFileSync(wrapper,`
const {app,net,safeStorage}=require('electron'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>false;Object.defineProperty(app,'isPackaged',{get:()=>true});
const updater=new EventEmitter();globalThis.testUpdater=updater;globalThis.updateChecks=0;globalThis.updateInstalls=[];
updater.checkForUpdates=async()=>{globalThis.updateChecks++;updater.emit('checking-for-update');};updater.quitAndInstall=(...args)=>globalThis.updateInstalls.push(args);
const updaterModule=${JSON.stringify(require.resolve('electron-updater'))};require.cache[updaterModule]={id:updaterModule,filename:updaterModule,loaded:true,exports:{autoUpdater:updater}};
app.whenReady().then(()=>fs.writeFileSync(path.join(app.getPath('userData'),'credentials.bin'),safeStorage.encryptString(JSON.stringify({access_token:'update-ui-token',user_id:${JSON.stringify(actor)},expires_at:4102444800}))));
require(${JSON.stringify(path.join(root,'main.cjs'))});`);
(async()=>{const app=await _electron.launch({executablePath:require('electron'),args:[wrapper],timeout:45000}),page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.locator('#desktop-options').waitFor({state:'attached'});await page.locator('#home-stats').waitFor();
 await page.locator('#desktop-update-main').click();
 await page.locator('#desktop-update-progress[open]').waitFor();assert.equal(await page.locator('#desktop-settings[open]').count(),0);
 await page.waitForFunction(()=>document.querySelector('#desktop-update-title').textContent==='Проверяем обновления');
 await app.evaluate(()=>{testUpdater.emit('update-available',{version:'99.0.0'});testUpdater.emit('download-progress',{percent:37,transferred:38797312,total:104857600,bytesPerSecond:1048576});});
 await page.waitForFunction(()=>document.querySelector('#desktop-update-progress progress').value===37);assert.match(await page.locator('#desktop-update-detail').textContent(),/37,0 МБ из 100,0 МБ/);
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/update-download.png')});
 await app.evaluate(()=>testUpdater.emit('error',new Error('Тестовая потеря связи')));await page.locator('[data-retry]').waitFor();assert.match(await page.locator('#desktop-update-detail').textContent(),/потеря связи/);
 await page.locator('[data-retry]').click();await page.waitForFunction(()=>document.querySelector('#desktop-update-title').textContent==='Проверяем обновления');
 await app.evaluate(()=>testUpdater.emit('update-not-available'));await page.waitForFunction(()=>document.querySelector('#desktop-update-title').textContent==='Установлена актуальная версия');
 assert.equal(await page.locator('#desktop-update-progress .update-meter').isVisible(),false);await page.locator('[data-background]').click();
 await page.evaluate(()=>location.hash='#new?kind=repair');await page.locator('#f-phone').fill('79999999999');
 await page.locator('#desktop-options').click();await page.locator('#desktop-update-now').click();
 await app.evaluate(()=>testUpdater.emit('update-downloaded',{version:'99.0.0'}));await page.waitForFunction(()=>document.querySelector('#desktop-update-detail').textContent.includes('Сохраните изменения'));
 assert.deepEqual(await app.evaluate(()=>updateInstalls),[]);await page.locator('[data-background]').click();assert.equal(await page.locator('#f-phone').inputValue(),'79999999999');
 // Save the intake normally, then request installation while its clean card stays open.
 await page.locator('#f-last_name').fill('Тест');await page.locator('#f-first_name').fill('Обновление');await page.locator('#f-equipment_name').fill('Kugoo M4');
 await page.locator('#intake-save').click();await page.locator('#repair-save').waitFor();
 // The original manual request remains active. A queued receipt without a printer is durable, not a permanent update block.
 for(let attempt=0;attempt<150&&!(await app.evaluate(()=>updateInstalls.length));attempt++)await new Promise(resolve=>setTimeout(resolve,100));
 const final=await page.evaluate(()=>window.fastgoDesktop.state());
 assert.deepEqual(await app.evaluate(()=>updateInstalls),[[true,true]],JSON.stringify(final.update));assert.equal(final.update.status,'installing');assert.equal(await page.evaluate(()=>window.fastgoHasUnsavedChanges()),false);
 assert.ok(final.pending>=2);assert.ok(fs.readdirSync(path.join(data,'backups')).some(name=>name.includes('before-update')));
 assert.deepEqual(errors,[]);console.log('PASS: immediate update dialog, real progress, retry/current states, dirty form protection, clean-card install and durable pending receipt');
 }catch(error){console.error(await page.locator('body').innerText());throw error;}finally{
 await page.evaluate(()=>{window.confirm=()=>true;location.hash='home';}).catch(()=>{});
 await page.waitForFunction(()=>!window.fastgoHasUnsavedChanges()).catch(()=>{});
 await app.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
