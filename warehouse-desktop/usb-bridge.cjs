const {allowedWarehouseURL}=require('./warehouse-bridge.cjs');
function registerUSBBridge({ipcMain,getWindow,getControl,getScanner,terminal,open,getDesktopStatus=()=>null,checkUpdates=async()=>null}){
 const trusted=(event,control=false)=>{const win=control?getControl():getWindow();if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!control&&!allowedWarehouseURL(event.senderFrame?.url))throw Error('Недоступно');};
 for(const [name,fn] of Object.entries({devices:()=>terminal.devices(),status:()=>getScanner().snapshot(),start:s=>getScanner().enable(s),stop:()=>getScanner().disable()}))ipcMain.handle('usb:'+name,(e,...args)=>{trusted(e,true);return fn(...args);});
 for(const [name,fn] of Object.entries({status:getDesktopStatus,checkUpdates,inbox:()=>getScanner().inbox(),result:(id,result)=>getScanner().result(id,result),open:()=>open(),target:v=>getScanner().setTarget(v),batch:key=>getScanner().batch(key),claim:key=>getScanner().claim(key),ack:(key,ids)=>getScanner().ack(key,ids),release:key=>getScanner().releaseTarget(key)}))ipcMain.handle('warehouse-usb:'+name,(e,...args)=>{trusted(e);return fn(...args);});
}
module.exports={registerUSBBridge};
