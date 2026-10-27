// Installer and helper launches can outlive their console pipes.
if(typeof process!=='undefined')for(const stream of [process.stdout,process.stderr])stream?.on('error',error=>{if(error.code!=='EPIPE')throw error;});
const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,protocol,net,shell,safeStorage,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Store,writes,stable}=require('./store.cjs'),{Synchronizer,transient}=require('./sync.cjs');
const {Updates}=require('./updates.cjs');
const {createWarehouseRuntime}=require('./warehouse-runtime.cjs');
let warehouseRuntime,backupReplica,warehouseUpdater;
let terminalProvisioner;
async function setupTerminal(terminal,serial){if(!actor)return '';if(!terminalProvisioner)terminalProvisioner=require('./warehouse-native/terminal-provision.cjs').createTerminalProvisioner({terminal,dir:app.getPath('userData'),safeStorage,account:warehouseStation,request:p=>cloud('/functions/v1/fastgo-terminal-setup',p)});return terminalProvisioner(serial);}
const {importLegacyStation}=require('./warehouse-station.cjs');
const stationFile=()=>path.join(app.getPath('userData'),'warehouse-station.bin');
function savedStation(){try{return JSON.parse(safeStorage.decryptString(fs.readFileSync(stationFile())));}catch{return null;}}
let stationLoading,stationAuthorizing=false;
async function warehouseStation(){
 const saved=savedStation();if(saved||!actor)return saved;
 if(!stationLoading){const account=actor;stationLoading=importLegacyStation({app,BrowserWindow,session,actor:account}).then(station=>{if(station&&actor===account)fs.writeFileSync(stationFile(),safeStorage.encryptString(JSON.stringify(station)));return actor===account?station:null;}).finally(()=>{stationLoading=null;});}
 return stationLoading;
}
async function authorizeWarehouse(){
 if(stationAuthorizing||!actor||!warehouseRuntime||updateInstalling||updateDraining)return;
 stationAuthorizing=true;
 try{const station=await warehouseStation();if(!station)return;const r=await cloud('/functions/v1/fastgo-warehouse',{action:'info',device_id:station.id,device_token:station.token});await warehouseRuntime.authorize(r.data?.terminal_allowed===true);}
 catch(e){if([401,403].includes(e.status))await warehouseRuntime.authorize(false);}
 finally{stationAuthorizing=false;}
}

const BASE='https://oqgpjfikjpcplnxueoki.supabase.co',KEY='sb_publishable_-aVkOpeHXncVZhF2jPuG5w_4DkRYqji';
app.setName('FastGo');
protocol.registerSchemesAsPrivileged([{scheme:'fastgo',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
if(!app.requestSingleInstanceLock())app.quit();
let win,store,sync,credentials=null,actor='',online=false,warming=false,lastError='',refreshing,printBusy=false,remoteBusy=false,nextProbe=0,updates,updateInstalling=false,updateDraining=false,activeRequests=0,warmPromise;
const printWindows=new Map(),webRoot=path.join(__dirname,'web');
const credentialFile=()=>path.join(app.getPath('userData'),'credentials.bin');
function notify({dataChanged=false}={}){if(win&&!win.isDestroyed())win.webContents.send('fg-changed',{dataChanged});}
function persistSession(s){credentials=s;actor=s?.user_id||'';if(!s){try{fs.unlinkSync(credentialFile());}catch{}return;}if(!safeStorage.isEncryptionAvailable())throw Error('Windows не предоставил защищённое хранилище входа');fs.writeFileSync(credentialFile(),safeStorage.encryptString(JSON.stringify(s)));}
async function validToken(){if(!credentials?.access_token)throw Object.assign(Error('Войдите в FastGo'),{status:401});if(credentials.expires_at*1000<Date.now()+45000&&credentials.refresh_token){
 if(!refreshing)refreshing=net.fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:credentials.refresh_token}),signal:AbortSignal.timeout(15000)}).then(async r=>{const j=await r.json();if(!r.ok)throw Object.assign(Error('Войдите в FastGo снова'),{status:r.status});persistSession({access_token:j.access_token,refresh_token:j.refresh_token,user_id:j.user.id,expires_at:Math.floor(Date.now()/1000)+j.expires_in});}).finally(()=>refreshing=null);
 await refreshing;
 }return credentials.access_token;}
async function cloud(pathname,body){if(!net.isOnline()||!pathname.endsWith('fastgo-warehouse')&&Date.now()<nextProbe)throw Error('Нет связи. Работаем с локальной базой');try{const token=pathname.startsWith('/functions/')?await validToken():credentials?.access_token;const r=await net.fetch(BASE+pathname,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok)throw Object.assign(Error(j.error||j.message||j.error_description||'Ошибка сервера'),{status:r.status});online=true;return j;}catch(e){if(transient(e)){online=false;nextProbe=Date.now()+15000;}throw e;}}
const remote=async(action,params,expectedActor=actor)=>{if(actor!==expectedActor)throw Object.assign(Error('Учётная запись изменилась. Синхронизация остановлена.'),{status:401});const j=await cloud('/functions/v1/fastgo-workshop-api',{action,params});if(!j.data)throw Error('Сервер не подтвердил ответ');return j.data;};
const remotePrint=async(action,params={})=>(await cloud('/functions/v1/fastgo-print-api',{action,params})).data;
function wrapError(error){return {__desktopError:true,message:error.message,status:error.status||0};}
function handle(channel,fn){ipcMain.handle(channel,async(event,...args)=>{try{if(!String(event.senderFrame?.url||'').startsWith('fastgo://app/'))throw Error('Недоверенное окно');if(updateInstalling&&channel!=='fg-state')throw Error('FastGo обновляется. Приложение сейчас откроется снова.');const tracked=!['fg-state','fg-update-check','fg-update-now'].includes(channel);if(tracked)activeRequests++;try{return await fn(event,...args);}finally{if(tracked)activeRequests--;}}catch(e){return wrapError(e);}});}
function warm(options={}){if(updateInstalling||updateDraining||!actor)return;if(warmPromise)return warmPromise;warming=true;const account=actor;warmPromise=(async()=>{try{await sync.warm(account,options);online=true;lastError='';}catch(e){online=false;lastError=e.message;}finally{warming=false;warmPromise=null;notify();}})();return warmPromise;}
async function request(event,{path:pathname,body={}}){
 if(!/^\/(functions\/v1\/(fastgo-workshop-api|fastgo-print-api|fastgo-warehouse|fastgo-avito|fastgo-backups)|auth\/v1\/(token\?grant_type=(password|refresh_token)|logout(\?scope=local)?|recover(\?redirect_to=.*)?|verify|signup))$/.test(pathname))throw Error('Недопустимый адрес');
 if(pathname.startsWith('/auth/'))return cloud(pathname,body);
 if(!actor)throw Object.assign(Error('Войдите в FastGo'),{status:401});
 if(pathname.endsWith('fastgo-warehouse')){const result=await cloud(pathname,body);if(body.action==='info')await warehouseRuntime?.authorize(result.data?.terminal_allowed===true);return result;}
 if(pathname.endsWith('fastgo-avito')||pathname.endsWith('fastgo-backups'))return cloud(pathname,body);
 if(pathname.endsWith('fastgo-print-api'))return {data:await remotePrint(body.action,body.params||{})};
 const action=body.action,p=body.params||{},account=actor;
 // A preorder is confirmed only after the primary database commits it. A cached
 // prior response must never turn a failed save into an apparent success.
 if(action==='preorder_save'){
  try{const data=await remote(action,p,account);store.db.prepare("DELETE FROM cache WHERE actor=? AND (key LIKE 'preorders:%' OR key LIKE 'preorder_get:%')").run(account);lastError='';notify({dataChanged:true});return {data};}
  catch(error){if(transient(error)){online=false;lastError=error.message;notify();}throw error;}
 }
 if(writes.has(action)){
  const me=store.cache(account,'me')||await remote('me',{},account);if(!['developer','owner','admin','receiver','manager','mechanic'].includes(me.role)||store.cache(account,'request_access')?.active===false)throw Object.assign(Error('Нет доступа к приёмкам мастерской'),{status:403});
  if(action==='payment'&&Number(p.amount)<0&&!['developer','owner','admin'].includes(me.role))throw Object.assign(Error('Возврат доступен администратору'),{status:403});
  const result=store.localWrite(account,action,p);notify({dataChanged:true});sync.run(account).catch(e=>{lastError=e.message;notify();});return {data:result,desktop:true};
 }
 if(action==='get'&&printWindows.get(event.sender.id)?.local)return {data:store.read(account,action,p)};
 // A dirty local card is displayed from SQLite, never replaced by a cloud read.
 const dirty=action==='get'&&store.pending(account).some(x=>x.kind===(p.kind||'repair')&&x.record_id===p.id);
 if(dirty&&!printWindows.get(event.sender.id)?.cloud)return {data:store.read(account,action,p)};
 try{const data=await remote(action,p,account);store.cacheResponse(account,action,p,data);lastError='';
  if(action==='me'&&!warming)setTimeout(warm,200);
  if(action==='list')return {data:store.read(account,action,p)};
  return {data};
 }catch(e){if(!transient(e))throw e;online=false;lastError=e.message;notify();return {data:store.read(account,action,p),offline:true};}
}
async function printRecord(p,{cloudRecord=false,key=randomUUID()}={}){
 if(!actor)throw Error('Войдите в FastGo');const account=actor,printer=store.setting('printer');if(!printer)throw Error('Выберите принтер в настройках приложения');
 if(p.intake&&store.printExists(account,key))return {enabled:true,duplicate:true};
 if(printBusy)throw Error('Принтер занят. Повторите после завершения текущего листа.');printBusy=true;
 let hidden,entry;try{
  const me=store.cache(account,'me')||await remote('me',{}).catch(e=>{if(!transient(e))throw e;return store.read(account,'me');});
  hidden=new BrowserWindow({show:false,width:1100,height:1400,webPreferences:{backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  entry={local:!cloudRecord,cloud:cloudRecord,context:{kind:p.kind||'repair',id:p.id,me},resolve:null,reject:null};printWindows.set(hidden.webContents.id,entry);
  const ready=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});
  const deadline=setTimeout(()=>entry.reject(Error('Документ не успел загрузиться')),90000);
  try{await hidden.loadURL('fastgo://app/document-host.html');await ready;}finally{clearTimeout(deadline);}
  if(actor!==account)throw Error('Учётная запись изменилась. Печать остановлена.');
  if(cloudRecord)await remotePrint('dispatch',{station_id:store.setting('station_id'),request_id:store.setting('claim_token'),job_id:key});
  store.printState(account,key,'dispatched',p.kind,p.id);
  await new Promise((resolve,reject)=>hidden.webContents.print({silent:true,printBackground:true,deviceName:printer,pageSize:'A4',copies:1,...(p.kind!=='storage'?{landscape:false,margins:{marginType:'custom',top:38,bottom:38,left:38,right:38}}:{})},(success,reason)=>success?resolve():reject(Error('Принтер не принял задание: '+reason))));
  store.printState(account,key,'submitted',p.kind,p.id);
  return {enabled:true};
 }catch(e){if(!store.printExists(account,key))store.printState(account,key,'failed',p.kind,p.id,e.message);throw e;}
 finally{if(hidden){printWindows.delete(hidden.webContents.id);hidden.destroy();}printBusy=false;notify();}
}
async function localPrints(){if(updateInstalling||updateDraining||printBusy||!actor||!store.setting('printer'))return;const row=store.db.prepare("SELECT * FROM print_jobs WHERE actor=? AND state='queued' ORDER BY created_at LIMIT 1").get(actor);if(!row)return;try{await printRecord({kind:row.kind,id:row.record_id},{key:row.key});}catch(e){lastError=e.message;notify();}}
async function pollPrint(){if(updateInstalling||updateDraining||remoteBusy||printBusy||!actor||!store?.setting('remote_print'))return;remoteBusy=true;let job;
 try{// Claim validates the active station and owner atomically on the server.
  const result=await remotePrint('claim',{station_id:store.setting('station_id'),request_id:store.setting('claim_token')});job=result.job;if(!job)return;
  await printRecord({kind:job.kind,id:job.record_id},{cloudRecord:true,key:job.id});
  await remotePrint('complete',{station_id:store.setting('station_id'),request_id:store.setting('claim_token'),job_id:job.id});
 }catch(e){lastError=e.message;if(job&&!['dispatched','submitted'].includes(store.printExists(actor,job.id)?.state))await remotePrint('fail',{station_id:store.setting('station_id'),request_id:store.setting('claim_token'),job_id:job.id,error:e.message}).catch(()=>{});}
 finally{remoteBusy=false;notify();}
}
async function backupTick(){if(!actor||!backupReplica||updateInstalling||updateDraining)return;try{store.backup();const me=store.cache(actor,'me');if(me)await backupReplica.tick({actor,owner:['owner','developer'].includes(me.role)});}catch(error){backupReplica.state={...backupReplica.state,status:'error',error:error.message};}}
async function reportDevice(){if(!actor||updateInstalling||updateDraining)return;const station=savedStation();if(!station)return;try{await cloud('/functions/v1/fastgo-warehouse',{action:'device_status',device_id:station.id,device_token:station.token,app:'desktop',version:app.getVersion(),host:require('node:os').hostname(),background:win?.isVisible?.()===false,update_status:updates?.state.status||'development',latest_version:updates?.state.version||app.getVersion(),blocking_reason:updates?.state.waitReason||'',pending_writes:store.stats(actor).pending});}catch{}}
app.whenReady().then(()=>{
 store=new Store(path.join(app.getPath('userData'),'FastGo.sqlite'));if(!store.setting('station_id'))store.setting('station_id',randomUUID());store.setting('claim_token',randomUUID());
 try{credentials=JSON.parse(safeStorage.decryptString(fs.readFileSync(credentialFile())));actor=credentials?.user_id||'';}catch{}
 sync=new Synchronizer(store,remote,notify);
 protocol.handle('fastgo',async req=>{const url=new URL(req.url);if(url.hostname!=='app')return new Response('Forbidden',{status:403});const relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),target=path.resolve(webRoot,relative||'workshop.html');if(!target.startsWith(webRoot+path.sep))return new Response('Forbidden',{status:403});
  return net.fetch(require('node:url').pathToFileURL(target).href);
 });
 handle('fg-warehouse-station-get',warehouseStation);
 handle('fg-warehouse-station-save',(_e,value)=>{if(!value?.id||!value?.token)throw Error('Неверное рабочее место');if(!safeStorage.isEncryptionAvailable())throw Error('Защищённое хранилище недоступно');fs.writeFileSync(stationFile(),safeStorage.encryptString(JSON.stringify(value)));return true;});
 handle('fg-session-get',()=>credentials);
 handle('fg-session-save',async(_e,s)=>{if(!s?.access_token||!s.user_id)throw Error('Неверная сессия');if(actor&&actor!==s.user_id)await warehouseRuntime?.authorize(false);persistSession(s);notify();void authorizeWarehouse();return true;});
 handle('fg-session-clear',async()=>{await warehouseRuntime?.authorize(false);persistSession(null);notify();return true;});
 handle('fg-request',request);
 handle('fg-diagnostics',()=>{if(!actor)throw Error('Войдите в FastGo');const member=store.cache(actor,'me');if(!['owner','developer'].includes(member?.role))throw Error('Доступно только владельцу');return store.diagnostics(actor);});
 handle('fg-home-data',()=>{if(!actor)throw Error('Войдите в FastGo');const member=store.cache(actor,'me');if(store.cache(actor,'request_access')?.active===false||!['developer','owner','admin','receiver','manager','mechanic'].includes(member?.role))throw Error('Нет доступа к мастерской');return store.homeData(actor);});
 handle('fg-state',()=>({warehouseUpdate:warehouseUpdater?.state,recovery:backupReplica?.state,version:app.getVersion(),host:require('node:os').hostname(),background:win?.isVisible?.()===false,update:updates?.state||{status:'development'},online:net.isOnline()&&online,warming,initialSync:!!(warming&&actor&&!store.cache(actor,'sync_checkpoint')),lastError:lastError||sync.lastError,printer:store.setting('printer'),remotePrint:!!store.setting('remote_print'),...(actor?store.stats(actor):{pending:0,conflicts:0,records:0})}));
 handle('fg-backups-check',async()=>{if(!actor)throw Error('Войдите в FastGo');await backupTick();return backupReplica.state;});
 handle('fg-update-check',async()=>{await updates?.check();return updates?.state;});
 handle('fg-update-now',()=>{if(!updates)throw Error('Обновления доступны в установленной версии FastGo');setTimeout(()=>updates.now(),0);return true;});
 handle('fg-sync',async()=>{nextProbe=0;await sync.run(actor);await warm({force:true});return true;});
 handle('fg-printers',()=>win.webContents.getPrintersAsync());
 handle('fg-configure',async(_e,p)=>{const printers=await win.webContents.getPrintersAsync();if(!printers.some(x=>x.name===p.printer))throw Error('Выберите установленный принтер');store.setting('printer',p.printer);if(p.remotePrint){await remotePrint('activate',{station_id:store.setting('station_id')});store.setting('remote_print',true);}else if(store.setting('remote_print')){await remotePrint('deactivate');store.setting('remote_print',false);}notify();return true;});
 handle('fg-conflicts',()=>store.conflicts(actor).map(x=>({seq:x.seq,kind:x.kind,id:x.record_id,action:x.action,patch:x.patch,base:x.base,error:x.error})));
 handle('fg-resolve',async(_e,{seq,choice})=>{const op=store.pending(actor).find(x=>x.seq===seq);if(!op)throw Error('Изменение не найдено');const {record}=await remote('get',{kind:op.kind,id:op.record_id});store.resolve(actor,seq,choice,record);await sync.run(actor);notify({dataChanged:true});return true;});
 handle('fg-print',(_e,p)=>{if(!actor)throw Error('Войдите в FastGo');if(!p.intake)return printRecord(p);const key='intake:'+p.kind+':'+p.id;if(!store.printExists(actor,key))store.printState(actor,key,'queued',p.kind,p.id);localPrints();return {enabled:true};});
 handle('fg-print-context',event=>{const context=printWindows.get(event.sender.id)?.context;if(!context)throw Error('Не печатное окно');return context;});
 handle('fg-print-ready',event=>{const job=printWindows.get(event.sender.id);if(!job)throw Error('Не печатное окно');job.resolve();return true;});
 Menu.setApplicationMenu(null);
 win=new BrowserWindow({show:!process.argv.includes('--background'),width:1380,height:900,minWidth:800,minHeight:600,title:'FastGo',backgroundColor:'#0b1726',autoHideMenuBar:true,titleBarStyle:'hidden',titleBarOverlay:{color:'#0c1522',symbolColor:'#dce8f5',height:47},webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 const background=require('./warehouse-native/background.cjs').createBackground({app,getWindow:()=>win,Tray,Menu,nativeImage,icon:path.join(webRoot,'fastgo-logo.png'),checkUpdates:()=>updates?.now()});background.attach(win);
 win.setMenu(null);
 win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('fastgo://app/')){event.preventDefault();if(url.startsWith('https://'))shell.openExternal(url);}});
 warehouseRuntime=createWarehouseRuntime({app,BrowserWindow,ipcMain,getWindow:()=>win,updates:()=>updates,setupTerminal,warehouseCall:async action=>{const station=savedStation();if(!station||!actor)return [];try{return(await cloud('/functions/v1/fastgo-warehouse',{action,device_id:station.id,device_token:station.token})).data;}catch(e){if([401,403].includes(e.status))await warehouseRuntime.authorize(false);return [];}}});
 win.webContents.on('did-finish-load',()=>warehouseRuntime.loaded());
 win.loadURL('fastgo://app/workshop.html#home');
 void authorizeWarehouse();setInterval(()=>void authorizeWarehouse(),30000);
 backupReplica=new (require('./warehouse-native/backup-replica.cjs').BackupReplica)({dir:path.join(app.getPath('userData'),'recovery'),secure:{encrypt:s=>{if(!safeStorage.isEncryptionAvailable())throw Error('Windows не предоставил защищённое хранилище');return safeStorage.encryptString(s);},decrypt:b=>safeStorage.decryptString(b)},call:async(action,p)=>(await cloud('/functions/v1/fastgo-backups',{action,...p})).data,fetcher:net.fetch.bind(net),allowedOrigins:[BASE],app:'desktop',host:require('node:os').hostname()});
 setTimeout(()=>void backupTick(),30000);setInterval(()=>void backupTick(),60000);
 setInterval(()=>void reportDevice(),60000);
 if(app.isPackaged&&process.platform==='win32'){
  warehouseUpdater=new (require('./warehouse-updater.cjs').WarehouseUpdater)({dir:path.join(app.getPath('userData'),'warehouse-update'),fetcher:net.fetch.bind(net),canInstall:()=>!updates||!['ready','preparing','installing'].includes(updates.state.status),report:async state=>{const station=savedStation();if(!actor||!station||!state.version)return;await cloud('/functions/v1/fastgo-warehouse',{action:'device_status',device_id:station.id,device_token:station.token,app:'warehouse',version:state.version,host:require('node:os').hostname(),update_status:state.status,latest_version:state.latest_version,error:state.error,blocking_reason:state.blocking_reason,observer:'companion'});}});
  setTimeout(()=>void warehouseUpdater.tick(),45000);setInterval(()=>void warehouseUpdater.tick(),300000);
 }
 // Never put printing behind a database upload or its network timeout.
 setInterval(()=>{if(actor&&!updateInstalling&&!updateDraining)sync.run(actor).catch(()=>{});},5000);
 setInterval(()=>{if(actor){localPrints();pollPrint();}},1000);
 setInterval(()=>{if(actor&&!warming)warm();},15000);
 if(app.isPackaged){
  updates=new Updates({updater:require('electron-updater').autoUpdater,changed:()=>{if(updates?.state.status==='error'){updateInstalling=false;updateDraining=false;}if(win&&!win.isDestroyed())win.webContents.send('fg-update-changed');},
   canInstall:async immediate=>{
    if(!win||win.isDestroyed()){updateDraining=false;return {allowed:false,reason:'Ожидаем открытия приложения'};}
    const rendererReason=await win.webContents.executeJavaScript('window.fastgoUpdateBlockReason?.('+Boolean(immediate)+') ?? "Дожидаемся загрузки приложения"');
    const idle=!rendererReason;
    // Stop starting new polls while existing requests drain. One-second print polling
    // must not starve installation forever, but any claimed print must finish first.
    updateDraining=idle;
    // Queued jobs are durable and resume after restart; only active work must drain.
    const busy=()=>warehouseUpdater?.state.status==='installing'?'Завершаем обновление склада':backupReplica?.busy?'Завершаем резервную копию':warehouseRuntime?.busy()?'Завершите документ склада и передачу сканов':printBusy?'Завершаем печать документа':remoteBusy?'Завершаем запрос к очереди печати':sync.busy||warming?'Завершаем синхронизацию базы':activeRequests?'Завершаем текущий запрос':'';
    const waiting=rendererReason||busy();if(waiting)return {allowed:false,reason:waiting};
    // Recheck on the renderer thread and block new input atomically before quitting.
    const locked=await win.webContents.executeJavaScript('window.fastgoLockForUpdate?.('+Boolean(immediate)+') === true');
    if(!locked){updateDraining=false;return {allowed:false,reason:'Завершите ввод и сохраните изменения'};}
    const finalBusy=busy();if(finalBusy){await win.webContents.executeJavaScript('window.fastgoReleaseUpdateLock?.()');updateDraining=false;return {allowed:false,reason:finalBusy};}
    return true;
   },prepare:()=>{store.backup('before-update-'+Date.now());updateInstalling=true;}});
  setTimeout(()=>updates.check(),15000);
  setInterval(()=>updates.check(),60000);
  setInterval(()=>updates.tick(),1000);
 }

});
app.on('second-instance',(_event,argv=[])=>{if(argv.includes('--background')||!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{warehouseRuntime?.close();try{store?.backup();store?.close();}catch{}});
