const path=require('node:path');
const {TerminalUpdate}=require('./warehouse-native/terminal-update.cjs');
const {createAutoTerminal}=require('./warehouse-native/auto-terminal.cjs');
const {USBScanner}=require('./warehouse-native/usb-scanner.cjs');
const {registerUSBBridge}=require('./warehouse-native/usb-bridge.cjs');
const {registerTerminalLauncher,registerWarehouseAttention}=require('./warehouse-native/warehouse-bridge.cjs');
function createWarehouseRuntime({app,BrowserWindow,ipcMain,getWindow,updates,warehouseCall=async()=>[],setupTerminal=async()=>''}){
 let usb=null,authorized=false,control,updaterWindow,opening=false,lastMode='',usbError='',authChain=Promise.resolve();
 const openedCloud=new Set();
 const terminal=new TerminalUpdate({adb:path.join(process.resourcesPath,'platform-tools','adb.exe'),dir:path.join(app.getPath('userData'),'terminal-update')});
 let nextNativeCheck=Date.now()+15000;const autoTerminal=createAutoTerminal({terminal,blocked:()=>!authorized||!!usb&&(usb.state.pending.length>0||!!usb.target),afterUpdate:serial=>setupTerminal(terminal,serial)});
 const assets=path.join(__dirname,'warehouse-native');
 const show=(kind)=>{const old=kind==='usb'?control:updaterWindow;if(old&&!old.isDestroyed()){old.focus();return;}
 const child=new BrowserWindow({parent:getWindow(),width:720,height:760,webPreferences:{preload:path.join(assets,kind==='usb'?'usb-preload.cjs':'terminal-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if(kind==='usb')control=child;else updaterWindow=child;
 child.webContents.on('will-navigate',e=>e.preventDefault());child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.loadFile(path.join(assets,kind==='usb'?'usb-control.html':'terminal.html'));
 };
 const getScanner=()=>{if(!authorized||!usb)throw Error('Этот ноутбук не разрешён для ТСД. Откройте склад и подключите рабочее место.');return usb;};
 registerTerminalLauncher(ipcMain,getWindow,()=>{getScanner();show('terminal');});
 registerWarehouseAttention(ipcMain,getWindow);
 for(const [name,fn] of Object.entries({devices:()=>terminal.devices(),install:s=>terminal.install(s),installNative:s=>terminal.installNative(s)}))ipcMain.handle('terminal:'+name,(e,...args)=>{if(!updaterWindow||updaterWindow.isDestroyed()||e.sender!==updaterWindow.webContents||e.senderFrame!==updaterWindow.webContents.mainFrame)throw Error('Недоступно');getScanner();return fn(...args);});
 registerUSBBridge({ipcMain,getWindow,getControl:()=>control,getScanner,terminal,open:()=>{getScanner();show('usb');},getDesktopStatus:()=>({version:app.getVersion(),host:require('node:os').hostname(),background:getWindow()?.isVisible?.()===false,update:updates()?.state||{status:'development'},usb:authorized&&usb?usb.snapshot():{status:usbError||'ТСД на этом ноутбуке не подключён',pending:0}}),checkUpdates:async()=>{await updates()?.check();return updates()?.state;}});
 function authorize(allowed){const next=authChain.then(()=>applyAuthorization(allowed));authChain=next.catch(()=>{});return next;}
 async function applyAuthorization(allowed){authorized=allowed;if(!allowed){if(usb){await usb.close();usb=null;}lastMode='';return;}
 if(!usb){try{usb=await new USBScanner({terminal,dir:path.join(app.getPath('userData'),'usb-scanner'),assets}).init();usbError='';lastMode=usb.state.mode+':'+(usb.state.modeRevision||0);}catch(e){usbError='USB: '+e.message;}}
 }
 async function tick(){
  if(opening||!authorized)return;
  if(Date.now()>=nextNativeCheck){nextNativeCheck=Date.now()+60000;void autoTerminal.tick();}
  const win=getWindow();if(!win||win.isDestroyed())return;
  const url=win.webContents.getURL(),kind=usb?.state.mode,request=kind+':'+(usb?.state.modeRevision||0);
  const modePending=['receipt','sale'].includes(kind)&&request!==lastMode;
  opening=true;
  try{
   if(url.startsWith('fastgo://app/warehouse.html')){
    if(modePending&&await win.webContents.executeJavaScript('window.fastgoWarehouseOpenMode?.('+JSON.stringify(kind)+') ?? false')){lastMode=request;if(win.isMinimized?.())win.restore();win.show?.();win.focus();}
    return;
   }
   if(!url.startsWith('fastgo://app/workshop.html'))return;
   const batches=modePending?[]:await Promise.all([warehouseCall('queue'),warehouseCall('live_jobs')]);
   const jobs=batches.flat().filter(j=>j.state!=='done'&&j.terminal_id!==j.station_id);
   const next=jobs.find(j=>!openedCloud.has(j.id+':'+(j.payload.revision||0)));
   if(!modePending&&!next)return;
   if(!await win.webContents.executeJavaScript('typeof window.fastgoHasUnsavedChanges === "function" && !window.fastgoHasUnsavedChanges() && !document.querySelector("dialog[open],.modal")'))return;
   await win.loadURL('fastgo://app/warehouse.html?unified=1');
   if(next)openedCloud.add(next.id+':'+(next.payload.revision||0));
   if(win.isMinimized?.())win.restore();win.show?.();win.focus();
  }finally{opening=false;}
 }
 const timer=setInterval(()=>void tick().catch(()=>{}),800);
 return {authorize,loaded:()=>{},busy:()=>terminal.busy||!!usb&&(usb.state.pending.length>0||!!usb.target),close:()=>{clearInterval(timer);void usb?.close();}};
}
module.exports={createWarehouseRuntime};
