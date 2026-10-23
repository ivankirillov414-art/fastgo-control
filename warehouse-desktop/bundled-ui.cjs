const fs=require('node:fs'),path=require('node:path');
const legacyURL='https://ivankirillov414-art.github.io/fastgo-control/warehouse.html';
async function prepareBundledUI({app,BrowserWindow,session,protocol,net,safeStorage}){
 const root=path.join(__dirname,'web');
 protocol.handle('fastgo',request=>{const url=new URL(request.url),target=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\/+/,''));if(url.hostname!=='app'||!target.startsWith(root+path.sep))return new Response('Forbidden',{status:403});return net.fetch(require('node:url').pathToFileURL(target).href);});
 const marker=path.join(app.getPath('userData'),'warehouse-bundled-ui-v1.txt');if(fs.existsSync(marker))return;
 let window,intercepted=false;const partition=session.defaultSession;
 try{
  partition.protocol.handle('https',()=>new Response('<!doctype html><title>FastGo migration</title>',{headers:{'Content-Type':'text/html'}}));
  intercepted=true;
  window=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});await window.loadURL(legacyURL);
  const values=await window.webContents.executeJavaScript('Object.fromEntries(Object.keys(localStorage).filter(k=>k==="fastgo_warehouse_session_v1"||k.startsWith("fgwarehouse:")).map(k=>[k,localStorage.getItem(k)]))');
  if(Object.keys(values).length){if(!safeStorage.isEncryptionAvailable())throw Error('Не удалось защитить резервную копию склада');fs.writeFileSync(path.join(app.getPath('userData'),'warehouse-before-bundled-ui.bin'),safeStorage.encryptString(JSON.stringify(values)));}
  partition.protocol.unhandle('https');intercepted=false;await window.loadURL('fastgo://app/migration.html');
  await window.webContents.executeJavaScript('for(const [key,value] of Object.entries('+JSON.stringify(values)+'))if(localStorage.getItem(key)===null)localStorage.setItem(key,value)');
  fs.writeFileSync(marker,new Date().toISOString());
 }finally{if(intercepted)partition.protocol.unhandle('https');if(window&&!window.isDestroyed())window.destroy();}
}
module.exports={prepareBundledUI};
