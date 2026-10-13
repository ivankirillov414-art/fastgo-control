const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const {Store}=require('../store.cjs');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-desktop-smoke-')),actor='11111111-1111-4111-8111-111111111111';
const store=new Store(path.join(data,'FastGo.sqlite'));
for(const [key,value] of Object.entries({request_access:{active:true},me:{profile_id:actor,role:'owner',name:'Тест',can_sell:true,can_edit_catalog:true},catalog:{works:[],parts:[],staff:[],categories:[]},legal:{legal_name:'FastGo'}}))store.cache(actor,key,value);
store.close();
const wrapper=path.join(data,'launch.cjs');fs.writeFileSync(wrapper,`const {app,net,safeStorage}=require('electron');const fs=require('node:fs'),path=require('node:path');app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>false;app.whenReady().then(()=>fs.writeFileSync(path.join(app.getPath('userData'),'credentials.bin'),safeStorage.encryptString(JSON.stringify({access_token:'offline-smoke-token',refresh_token:'offline-smoke-refresh',user_id:${JSON.stringify(actor)},expires_at:4102444800}))));require(${JSON.stringify(path.join(root,'main.cjs'))});`);
async function launch(){const app=await _electron.launch({executablePath:require('electron'),args:[wrapper],timeout:45000});const page=await app.firstWindow();page.on('pageerror',e=>console.error('Renderer:',e.message));await page.locator('#desktop-state-text').waitFor();return {app,page};}
(async()=>{let opened=await launch();try{
 await opened.page.waitForFunction(()=>document.querySelector('#desktop-state-text')?.textContent.includes('Работа без сети'));
 await opened.page.evaluate(()=>location.hash='#new?kind=repair');
 await opened.page.locator('#f-last_name').fill('Клиент');await opened.page.locator('#f-first_name').fill('Тест');await opened.page.locator('#f-phone').fill('79999999999');await opened.page.locator('#f-equipment_name').fill('Kugoo Max Speed');await opened.page.locator('#f-intake_amount').fill('500');
 await opened.page.locator('#intake-save').click();await opened.page.waitForFunction(()=>location.hash.startsWith('#order?'),{},{timeout:45000});
 assert.match(await opened.page.locator('h1').innerText(),/Ремонт/);assert.match(await opened.page.locator('#desktop-state-text').innerText(),/К отправке: 2/);
 assert(Array.isArray(await opened.page.evaluate(()=>window.fastgoDesktop.printers())));
 await opened.app.close();opened=await launch();await opened.page.evaluate(()=>location.hash='#repairs');await opened.page.getByText('Клиент Тест',{exact:false}).first().waitFor();
 const state=await opened.page.evaluate(()=>window.fastgoDesktop.state());assert.equal(state.records,1);assert.equal(state.pending,2);console.log('PASS: Windows sandbox bridge, offline intake without photos, durable restart and printer enumeration');
 }finally{await opened.app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
