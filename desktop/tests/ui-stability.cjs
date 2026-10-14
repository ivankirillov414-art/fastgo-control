const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const {Store}=require('../store.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-stable-ui-')),actor='11111111-1111-4111-8111-111111111111';
const store=new Store(path.join(data,'FastGo.sqlite'));store.setting('remote_print',true);store.close();
const wrapper=path.join(data,'launch.cjs');
fs.writeFileSync(wrapper,`const {app,net,safeStorage}=require('electron');const fs=require('node:fs'),path=require('node:path');app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>true;globalThis.printPolls=0;globalThis.syncValue=0;globalThis.fakeOffline=false;globalThis.cards=()=>Array.from({length:globalThis.syncValue},(_,i)=>({id:'repair-'+i,repair_number:i+1,revision:1,status:'accepted',brand:'Kugoo',model:'M4',created_at:'2026-10-14'}));
globalThis.fetch=async(url,options)=>{if(globalThis.fakeOffline)throw Error('Offline');const {action,params={}}=JSON.parse(options.body);let data;if(String(url).endsWith('fastgo-print-api')){globalThis.printPolls++;data={job:null};}else if(action==='sync_status')data={protocol:1,incremental:true,version:String(globalThis.syncValue),epoch:'test',access:'owner',catalog:'same'};else if(action==='sync_changes')data={reset:false,version:params.until,records:globalThis.cards().map(r=>({kind:'repair',id:r.id})),overview:true};else if(action==='me')data={profile_id:${JSON.stringify(actor)},role:'owner',name:'Тест',can_sell:true,can_edit_catalog:true};else if(action==='request_access')data={active:true};else if(action==='catalog')data={services:[],works:[],parts:[],staff:[],categories:[]};else if(action==='overview')data={repairs:globalThis.syncValue,overdue:0,ready:0,storage:0,storage_due:0,today_payments:0,debt:0};else if(action==='get')data={record:globalThis.cards().find(r=>r.id===params.id)};else if(action==='list')data={items:params.kind==='repair'?globalThis.cards():[],count:params.kind==='repair'?globalThis.syncValue:0};else data={};return new Response(JSON.stringify({data}),{status:200});};
app.whenReady().then(()=>fs.writeFileSync(path.join(app.getPath('userData'),'credentials.bin'),safeStorage.encryptString(JSON.stringify({access_token:'test-token',user_id:${JSON.stringify(actor)},expires_at:4102444800}))));require(${JSON.stringify(path.join(root,'main.cjs'))});`);
(async()=>{const app=await _electron.launch({executablePath:require('electron'),args:[wrapper],timeout:45000});const page=await app.firstWindow();try{
 await page.locator('#home-stats [data-count=working]').waitFor();
 await page.waitForFunction(async()=>!(await window.fastgoDesktop.state()).warming);await page.waitForTimeout(700);
 await page.evaluate(()=>{window.originalIntake=document.querySelector('.home-actions a[href="#new?kind=repair"]');window.originalStorage=document.querySelector('.home-actions a[href="#new?kind=storage"]');document.querySelector('#priority-search input').value='Не сбрасывать';window.dataEvents=0;window.addEventListener('workshop-data-changed',()=>window.dataEvents++);});
 await page.waitForTimeout(5500);assert((await app.evaluate(()=>globalThis.printPolls))>=4);
 assert(await page.evaluate(()=>window.originalIntake.isConnected&&window.originalStorage.isConnected));assert.equal(await page.evaluate(()=>window.dataEvents),0);
 await page.evaluate(()=>window.fastgoDesktop.sync());await page.waitForTimeout(500);
 assert(await page.evaluate(()=>window.originalIntake.isConnected&&window.originalStorage.isConnected));assert.equal(await page.evaluate(()=>window.dataEvents),0);
 await app.evaluate(()=>{globalThis.syncValue=7;});await page.evaluate(()=>window.fastgoDesktop.sync());
 await page.waitForFunction(()=>document.querySelector('#home-stats [data-count=working]')?.textContent==='7');assert.equal(await page.evaluate(()=>window.dataEvents),1);
 assert(await page.evaluate(()=>window.originalIntake.isConnected&&window.originalStorage.isConnected));assert.equal(await page.locator('#priority-search input').inputValue(),'Не сбрасывать');
 await page.evaluate(()=>{window.currentIntake=document.querySelector('.home-actions a[href="#new?kind=repair"]');});
 await app.evaluate(()=>{globalThis.fakeOffline=true;});await page.evaluate(()=>window.fastgoDesktop.sync());await page.waitForTimeout(2200);
 assert(await page.evaluate(()=>window.currentIntake.isConnected));assert.equal(await page.evaluate(()=>window.dataEvents),1);
 await page.evaluate(()=>{location.hash='new?kind=repair';});await page.locator('input').first().waitFor();assert.equal(await page.evaluate(()=>window.fastgoUpdateSafe(true)),false);
 await page.locator('#f-phone').fill('+79991234567');
 assert.equal(await page.evaluate(()=>window.fastgoHasUnsavedChanges()),true);
 await page.locator('#f-phone').blur();
 assert.equal(await page.evaluate(()=>window.fastgoLockForUpdate(true)),false);
 assert.equal(await page.evaluate(()=>document.body.inert),false);
 assert.equal(await page.locator('#f-phone').inputValue(),'+79991234567');
 console.log('PASS: empty print polling, unchanged sync and network failure preserve home buttons; real data change refreshes once');
 }catch(e){console.error(await page.locator('body').innerText());throw e;}finally{
 // Explicitly discard the test-only intake after proving its data survived.
 // Closing Electron with a beforeunload dialog races Playwright's shutdown.
 await page.evaluate(()=>{window.confirm=()=>true;location.hash='home';}).catch(()=>{});
 await page.waitForFunction(()=>!window.fastgoHasUnsavedChanges()).catch(()=>{});
 await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
