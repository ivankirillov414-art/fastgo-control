const fs=require('node:fs'),path=require('node:path');
async function importLegacyStation({app,BrowserWindow,session,actor}){
 if(!actor)return null;
 const legacy=path.join(app.getPath('appData'),'FastGo Склад');if(!fs.existsSync(path.join(legacy,'Local Storage')))return null;
 const partition=session.fromPath(legacy,{cache:false});let win;
 try{partition.protocol.handle('https',()=>new Response('<!doctype html><title>FastGo migration</title>',{headers:{'Content-Type':'text/html'}}));
 win=new BrowserWindow({show:false,webPreferences:{session:partition,contextIsolation:true,nodeIntegration:false,sandbox:true}});
 await win.loadURL('https://ivankirillov414-art.github.io/fastgo-control/warehouse.html');
 return await win.webContents.executeJavaScript('JSON.parse(localStorage.getItem('+JSON.stringify('fgwarehouse:'+actor+':station')+')||"null")');
 }finally{if(win&&!win.isDestroyed())win.destroy();partition.protocol.unhandle('https');}
}
module.exports={importLegacyStation};
