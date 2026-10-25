// Isolated, hidden Electron probe: no installed FastGo app or workstation data.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.FASTGO_PLAYWRIGHT?path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'):'playwright');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-photo-cache-')),root=path.resolve(__dirname,'..'),host=path.join(dir,'probe.cjs');
fs.writeFileSync(host,`const {app,protocol,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',${JSON.stringify(path.join(dir,'profile'))});
protocol.registerSchemesAsPrivileged([{scheme:'fastgo',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);globalThis.photoFetches=0;
app.whenReady().then(async()=>{protocol.handle('fastgo',req=>{const name=new URL(req.url).pathname;if(name==='/probe')return new Response('<html><body>Cache probe</body></html>',{headers:{'Content-Type':'text/html'}});if(name==='/test-photo.png'){globalThis.photoFetches++;return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),{headers:{'Content-Type':'image/png'}});}const file=path.resolve(${JSON.stringify(root)},'.'+name);if(!file.startsWith(${JSON.stringify(root+path.sep)}))return new Response('',{status:403});return new Response(fs.readFileSync(file),{headers:{'Content-Type':'text/javascript'}});});const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});await win.loadURL('fastgo://app/probe');});`);
(async()=>{let app;try{
 for(let attempt=0;attempt<2;attempt++){
  app=await _electron.launch({executablePath:process.env.FASTGO_ELECTRON||path.join(root,'desktop/node_modules/electron/dist/electron.exe'),args:[host],timeout:30000});
  const page=await app.firstWindow();await page.waitForURL('fastgo://app/probe');
  const size=await page.evaluate(async()=>{window.warehouseDesktop={};const {cachedPhoto}=await import('/workshop/photo-cache.js');return(await cachedPhoto('fastgo://app/test-photo.png?token='+Math.random(),'account:part:immutable-path')).size;});
  assert.ok(size>0);assert.equal(await app.evaluate(()=>globalThis.photoFetches),attempt===0?1:0,'native disk cache persists across a full restart');
  await app.close();app=null;
 }
 console.log('PASS: hidden Electron, real fastgo:// secure origin, disk cache survives process restart; installed applications untouched');
}finally{if(app)await app.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('fastgo-photo-cache-'));fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
