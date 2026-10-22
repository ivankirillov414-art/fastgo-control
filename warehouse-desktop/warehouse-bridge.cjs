const WAREHOUSE_URL='https://ivankirillov414-art.github.io/fastgo-control/warehouse.html';
function allowedWarehouseURL(value){
 try{const u=new URL(value);return u.protocol==='fastgo:'&&u.hostname==='app'&&u.pathname==='/warehouse.html'||u.origin==='https://ivankirillov414-art.github.io'&&u.pathname==='/fastgo-control/warehouse.html';}catch{return false;}
}
function registerTerminalLauncher(ipcMain,getWindow,openTerminal){
 ipcMain.handle('terminal:open',event=>{
  const win=getWindow();
  if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!allowedWarehouseURL(event.senderFrame?.url))throw Error('Недоступно');
  openTerminal();
  return true;
 });
}
module.exports={WAREHOUSE_URL,allowedWarehouseURL,registerTerminalLauncher};
