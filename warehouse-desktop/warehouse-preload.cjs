const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('warehouseDesktop',Object.freeze({
 notifyAvito:p=>ipcRenderer.invoke('warehouse:notifyAvito',p),
 printBarcode:p=>ipcRenderer.invoke('warehouse:printBarcode',p),
 showIncoming:()=>ipcRenderer.invoke('warehouse:incoming'),
 openTerminalUpdater:()=>ipcRenderer.invoke('terminal:open'),
 desktopStatus:()=>ipcRenderer.invoke('warehouse-usb:status'),
 checkUpdates:()=>ipcRenderer.invoke('warehouse-usb:checkUpdates'),
 openUSBScanner:()=>ipcRenderer.invoke('warehouse-usb:open'),
 usbInbox:()=>ipcRenderer.invoke('warehouse-usb:inbox'),
 usbResult:(id,result)=>ipcRenderer.invoke('warehouse-usb:result',id,result),
 usbTarget:value=>ipcRenderer.invoke('warehouse-usb:target',value),
 usbBatch:key=>ipcRenderer.invoke('warehouse-usb:batch',key),
 usbClaim:key=>ipcRenderer.invoke('warehouse-usb:claim',key),
 usbAck:(key,ids)=>ipcRenderer.invoke('warehouse-usb:ack',key,ids),
 usbRelease:key=>ipcRenderer.invoke('warehouse-usb:release',key)
}));

window.addEventListener('DOMContentLoaded',()=>{document.body.classList.add('warehouse-native-window');});
