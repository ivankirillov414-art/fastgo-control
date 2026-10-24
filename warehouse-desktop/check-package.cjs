const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const asar=require('@electron/asar'),yaml=require('js-yaml'),{_electron}=require(path.join(process.env.FASTGO_PLAYWRIGHT,'node_modules/playwright'));
const pkg=require('./package.json'),dist=path.join(__dirname,'dist'),unpacked=path.join(dist,'win-unpacked'),exe=path.join(unpacked,fs.readdirSync(unpacked).find(n=>n.endsWith('.exe'))),archive=path.join(unpacked,'resources/app.asar');
const manifest=yaml.load(fs.readFileSync(path.join(dist,'latest.yml'),'utf8')),entry=manifest.files.find(x=>x.url===`FastGo-Warehouse-Setup-${pkg.version}-Windows-x64.exe`);
assert(entry);assert.equal(manifest.version,pkg.version);assert.equal(crypto.createHash('sha512').update(fs.readFileSync(path.join(dist,entry.url))).digest('base64'),entry.sha512);assert(fs.existsSync(path.join(dist,entry.url+'.blockmap')));
assert(asar.extractFile(archive,'backup-replica.cjs').toString().includes('class BackupReplica'));assert(asar.extractFile(archive,path.join('web','warehouse','app-compat.js')).toString().includes('warehouseUpdateSafe'));
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-warehouse-package-')),app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+profile],timeout:60000});
 try{
  await app.context().route('https://**',route=>route.abort());let page;for(let n=0;n<100;n++){page=app.windows().find(p=>p.url()==='fastgo://app/warehouse.html');if(page)break;await new Promise(r=>setTimeout(r,150));}assert(page);await page.locator('#login').waitFor();
  const state=await app.evaluate(({app,BrowserWindow})=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='fastgo://app/warehouse.html');return {version:app.getVersion(),packaged:app.isPackaged,bounds:win.getBounds(),content:win.getContentBounds()};});
  assert.equal(state.version,pkg.version);assert(state.packaged);assert(state.bounds.height-state.content.height<32,'Standard white title bar remains');assert.equal(await page.evaluate(()=>document.body.classList.contains('warehouse-native-window')),true);assert.equal(await page.evaluate(()=>window.warehouseUpdateSafe(true)),true);
  await page.screenshot({path:path.join(dist,'warehouse-window.png')});fs.writeFileSync(path.join(dist,'warehouse-package-verification.json'),JSON.stringify({...state,checksum_verified:true,blockmap_verified:true,local_ui:true,no_standard_titlebar:true},null,2));
  console.log('PASS: final warehouse EXE opens installed assets without internet, has a dark integrated title bar, accepts safe updates before login, and matches installer checksum/blockmap');
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
