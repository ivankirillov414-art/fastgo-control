const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules','playwright'));
const root=path.resolve(__dirname,'../warehouse-desktop'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-bundled-')),wrapper=path.join(data,'launch.cjs');
fs.writeFileSync(wrapper,`const {app,net}=require('electron');app.setPath('userData',${JSON.stringify(data)});net.isOnline=()=>false;require(${JSON.stringify(path.join(root,'terminal-update.cjs'))}).TerminalUpdate.prototype.devices=async()=>[];require(${JSON.stringify(path.join(root,'main.cjs'))});`);
(async()=>{const app=await _electron.launch({executablePath:process.env.FASTGO_ELECTRON||require(path.join(root,'node_modules/electron')),args:[wrapper],timeout:45000});try{
 let page;for(let i=0;i<60;i++){page=app.windows().find(p=>p.url()==='fastgo://app/warehouse.html');if(page)break;await new Promise(r=>setTimeout(r,200));}assert(page,'bundled warehouse window did not open');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.locator('#login').waitFor();assert.equal(await page.locator('#login button').innerText(),'Войти');assert.equal(await page.evaluate(()=>Boolean(window.warehouseDesktop)),true);assert(fs.existsSync(path.join(data,'warehouse-bundled-ui-v1.txt')));assert.deepEqual(errors,[]);
 console.log('PASS: standalone Electron warehouse boots from installed local assets with no internet, native USB bridge, preserved migration marker and login screen');
 }finally{await app.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
