const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let stage='archive checks',electronProcess;
function stopTestProcess(){if(electronProcess?.exitCode!==null)return;if(process.platform==='win32')require('node:child_process').spawnSync(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(electronProcess.pid),'/T','/F'],{windowsHide:true,timeout:10000});else electronProcess.kill('SIGKILL');}
const watchdog=setTimeout(()=>{console.error('Warehouse package verification timed out at: '+stage);stopTestProcess();process.exit(1);},120000);watchdog.unref();
console.log('Warehouse package check: '+stage);
const asar=require('@electron/asar'),yaml=require('js-yaml'),{_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'));
const pkg=require('./package.json'),dist=path.join(__dirname,'dist'),unpacked=path.join(dist,'win-unpacked'),exe=path.join(unpacked,fs.readdirSync(unpacked).find(n=>n.endsWith('.exe'))),archive=path.join(unpacked,'resources/app.asar');
assert.equal(pkg.build.productName,'FastGo Склад');assert.equal(pkg.build.nsis.shortcutName,'FastGo Склад');assert.equal(pkg.build.appId,'ru.fastgo.warehouse');
const manifest=yaml.load(fs.readFileSync(path.join(dist,'latest.yml'),'utf8')),entry=manifest.files.find(x=>x.url===`FastGo-Warehouse-Setup-${pkg.version}-Windows-x64.exe`);
assert(entry);assert.equal(manifest.version,pkg.version);assert.equal(crypto.createHash('sha512').update(fs.readFileSync(path.join(dist,entry.url))).digest('base64'),entry.sha512);assert(fs.existsSync(path.join(dist,entry.url+'.blockmap')));
assert(asar.extractFile(archive,'backup-replica.cjs').toString().includes('class BackupReplica'));assert(asar.extractFile(archive,path.join('web','warehouse','app-compat.js')).toString().includes('warehouseUpdateSafe'));
for(const file of ['network-diagnostics.cjs','network-window.cjs','network-preload.cjs','network-snapshot.ps1','network.html','network.css','network-ui.js'])assert(asar.extractFile(archive,file).length>0,'Missing installed diagnostics: '+file);
assert(asar.extractFile(archive,'printer-profiles.cjs').toString().includes('class PrinterProfiles'));
(async()=>{
 stage='launch';console.log('Warehouse package check: '+stage);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-warehouse-package-'));
 const queued=Array.from({length:6},(_,i)=>({id:'regression-scan-'+i,code:'FGP-00000001',time:new Date().toISOString(),target:null}));
 const scannerDir=path.join(profile,'usb-scanner');fs.mkdirSync(scannerDir,{recursive:true});
 fs.writeFileSync(path.join(scannerDir,'usb-scanner.json'),JSON.stringify({token:crypto.randomBytes(32).toString('hex'),serial:'',enabled:false,autoConnect:false,pending:queued,seen:queued.map(x=>x.id),results:[],mode:''}));
 let app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+profile],timeout:60000});
 electronProcess=app.process();
 const step=name=>{stage=name;console.log('Warehouse package check: '+name);};
 try{
  step('local login');
  await app.context().route('https://**',route=>route.abort());let page;for(let n=0;n<100;n++){page=app.windows().find(p=>p.url()==='fastgo://app/warehouse.html');if(page)break;await new Promise(r=>setTimeout(r,150));}assert(page);await page.locator('#login').waitFor();
  const state=await app.evaluate(({app,BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='fastgo://app/warehouse.html');return {version:app.getVersion(),packaged:app.isPackaged,bounds:win.getBounds(),content:win.getContentBounds()};});
  assert.equal(state.version,pkg.version);assert(state.packaged);assert(state.bounds.height-state.content.height<32,'Standard white title bar remains');assert.equal(await page.evaluate(()=>document.body.classList.contains('warehouse-native-window')),true);assert.equal(await page.evaluate(()=>window.warehouseUpdateSafe(true)),true);
  step('responsive native caption controls');
  for(const width of [1250,1000,850]){
   await app.evaluate(({BrowserWindow},width)=>{BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='fastgo://app/warehouse.html').setSize(width,700);},width);
   await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal((await page.locator('header').boundingBox()).height,64);
   for(const selector of ['#usb-scanner','#printer-settings']){const b=await page.locator(selector).boundingBox();assert(b&&b.x+b.width<=await page.evaluate(()=>innerWidth-148),'Caption overlap: '+selector);}
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='fastgo://app/warehouse.html').setSize(1250,850));
  await page.screenshot({path:path.join(dist,'warehouse-window.png')});
  step('printer discovery and settings');const printers=await page.evaluate(()=>window.warehouseDesktop.printers());assert(Array.isArray(printers.printers));assert(printers.profiles&&typeof printers.profiles==='object');await page.locator('#printer-settings').click();const printerDialog=page.getByRole('dialog',{name:'Принтер этикеток',exact:true});await printerDialog.locator('[data-printer]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-printer]')?.disabled===false,null,{timeout:15000});await page.screenshot({path:path.join(dist,'warehouse-printer-window.png')});await printerDialog.getByRole('button',{name:'Закрыть',exact:true}).click();
  step('network window');
  const newWindow=app.waitForEvent('window');await page.locator('#network-diagnostics').click();const network=await newWindow;await network.locator('#probe').waitFor();assert.equal(await network.evaluate(()=>typeof window.fastgoNetwork.probe),'function');assert.equal(typeof(await network.evaluate(()=>window.fastgoNetwork.status())).online,'boolean');
  const networkBounds=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/network.html'));return {height:w.getBounds().height,content:w.getContentBounds().height};});assert(networkBounds.height-networkBounds.content<32,'Network diagnostics retains a white title bar');await network.screenshot({path:path.join(dist,'network-window.png')});
  await network.close();
  step('downloaded update quits with six saved USB scans');
  assert.equal((await page.evaluate(()=>window.warehouseDesktop.desktopStatus())).usb.pending,6);
  // Use the actual updater guard, IPC, renderer beforeunload and tray lifecycle.
  // The installer handoff is simulated; NSIS replacement is checked separately
  // by installer-upgrade.ps1. This probe must really close the packaged process.
  const closed=app.waitForEvent('close',{timeout:15000});
  await app.evaluate(({app})=>{const updater=process.mainModule.require('electron-updater').autoUpdater;updater.checkForUpdates=async()=>{};updater.quitAndInstall=()=>{app.quit();};updater.emit('update-downloaded',{version:'99.0.0'});});
  await page.evaluate(()=>{void window.warehouseDesktop.checkUpdates();}).catch(error=>{if(!/closed|destroyed/i.test(error.message))throw error;});
  await closed;
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(scannerDir,'usb-scanner.json'),'utf8')).pending,queued,'Saved scans must survive quitting for an update');
  step('restart with the same profile and saved USB queue');
  app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+profile],timeout:30000});electronProcess=app.process();
  await app.context().route('https://**',route=>route.abort());page=await app.firstWindow();await page.locator('#login').waitFor();
  assert.equal((await page.evaluate(()=>window.warehouseDesktop.desktopStatus())).usb.pending,6);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(scannerDir,'usb-scanner.json'),'utf8')).pending,queued);
  fs.writeFileSync(path.join(dist,'warehouse-package-verification.json'),JSON.stringify({...state,checksum_verified:true,blockmap_verified:true,local_ui:true,no_standard_titlebar:true,network_window_verified:true,network_ipc_verified:true,printer_settings_verified:true,printer_discovery_warning:printers.warning||null,saved_usb_scans:6,update_guard_and_actual_quit_verified:true,restart_with_saved_queue_verified:true,installer_handoff_simulated:true},null,2));
  console.log('PASS: final warehouse EXE opens installed assets and network diagnostics without internet, both windows have dark integrated title bars, safe updates work before login, and installer checksum/blockmap match');
 }finally{
  step('test process cleanup');let timer;
  try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Test Electron did not exit within 10 seconds')),10000);})]);}
  catch(error){if(electronProcess?.exitCode===null){console.warn(error.message+'; stopping only the test Electron process tree');stopTestProcess();}}
  finally{clearTimeout(timer);clearTimeout(watchdog);}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
