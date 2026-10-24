const path=require('node:path'),{pathToFileURL}=require('node:url');
const {NetworkDiagnostics}=require('./network-diagnostics.cjs');
const {atomicWrite}=require('./backup-replica.cjs');
function registerNetworkDiagnostics({app,ipcMain,BrowserWindow,dialog,net,getWindow,getUpdate,engine}){
 let window,saving=false;const diagnostics=engine||new NetworkDiagnostics({dir:path.join(app.getPath('userData'),'network-diagnostics'),fetcher:net.fetch.bind(net),online:()=>net.isOnline(),update:getUpdate});
 const url=pathToFileURL(path.join(__dirname,'network.html')).href;
 const trusted=(event,owner=false)=>{const target=owner?getWindow():window;if(!target||target.isDestroyed()||event.sender!==target.webContents||event.senderFrame!==target.webContents.mainFrame||(!owner&&event.senderFrame.url!==url))throw Error('Диагностика недоступна для этого окна');};
 const open=()=>{
  if(window&&!window.isDestroyed()){window.show();window.focus();return;}
  window=new BrowserWindow({parent:getWindow(),width:820,height:800,minWidth:600,minHeight:520,title:'FastGo · Диагностика сети',backgroundColor:'#091827',titleBarStyle:'hidden',titleBarOverlay:{color:'#091827',symbolColor:'#dcecff',height:64},autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'network-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.loadURL(url);window.on('closed',()=>{window=null;});
 };
 ipcMain.handle('warehouse-network:open',event=>{trusted(event,true);open();return true;});
 ipcMain.handle('warehouse-network:status',event=>{trusted(event);return diagnostics.observe();});
 ipcMain.handle('warehouse-network:probe',event=>{trusted(event);return diagnostics.probe();});
 ipcMain.handle('warehouse-network:save',async event=>{
  trusted(event);if(saving)return {saved:false};saving=true;
  try{const selection=await dialog.showSaveDialog(window,{title:'Сохранить диагностику сети',defaultPath:'FastGo-Сеть-'+new Date().toISOString().slice(0,10)+'.json',filters:[{name:'Отчёт JSON',extensions:['json']}]});if(selection.canceled||!selection.filePath)return {saved:false};
   const report={format:1,app:'FastGo Склад',version:app.getVersion(),generated_at:new Date().toISOString(),network:diagnostics.observe()};atomicWrite(selection.filePath,Buffer.from(JSON.stringify(report,null,2)));return {saved:true};
  }finally{saving=false;}
 });
 const timer=setInterval(()=>{diagnostics.observe();const state=getUpdate?.()?.status;if(['downloading','error'].includes(state)&&Date.now()-diagnostics.lastProbe>=60000&&!diagnostics.busy)void diagnostics.probe().catch(()=>{});},10000);timer.unref?.();
 const close=()=>{clearInterval(timer);if(window&&!window.isDestroyed())window.destroy();};app.on('before-quit',close);
 return {open,summary:()=>diagnostics.summary(),close,diagnostics};
}
module.exports={registerNetworkDiagnostics};
