const {app,BrowserWindow,shell}=require('electron'),{Updates}=require('./updates.cjs');
app.setName('FastGo Склад');if(!app.requestSingleInstanceLock())app.quit();let win;
app.whenReady().then(()=>{win=new BrowserWindow({width:1250,height:850,minWidth:850,minHeight:620,title:'FastGo Склад',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 const url='https://ivankirillov414-art.github.io/fastgo-control/warehouse.html';
 const allowed=value=>{try{const u=new URL(value);return u.origin==='https://ivankirillov414-art.github.io'&&u.pathname==='/fastgo-control/warehouse.html';}catch{return false;}};
 win.webContents.on('will-navigate',(e,value)=>{if(!allowed(value))e.preventDefault();});win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return{action:'deny'};});win.loadURL(url);
 if(app.isPackaged){const updates=new Updates({updater:require('electron-updater').autoUpdater,canInstall:async()=>!win.isDestroyed()&&await win.webContents.executeJavaScript('(()=>{if(window.warehouseUpdateSafe?.() !== true)return false;document.body.inert=true;return true;})()'),prepare:()=>{},changed:()=>{if(updates.state.status==='error'&&!win.isDestroyed())void win.webContents.executeJavaScript('document.body.inert=false');}});setTimeout(()=>updates.check(),15000);setInterval(()=>updates.check(),60000);setInterval(()=>updates.tick(),5000);}
});app.on('second-instance',()=>{win?.restore();win?.focus();});app.on('window-all-closed',()=>app.quit());
