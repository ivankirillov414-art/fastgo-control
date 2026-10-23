const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,...args)=>ipcRenderer.invoke(channel,...args).then(value=>{if(value?.__desktopError)throw Error(value.message);return value;});
contextBridge.exposeInMainWorld('fastgoDesktop',Object.freeze({
 warehouseStation:()=>invoke('fg-warehouse-station-get'),saveWarehouseStation:value=>invoke('fg-warehouse-station-save',value),
 version:'1.0.11',getSession:()=>invoke('fg-session-get'),saveSession:s=>invoke('fg-session-save',s),clearSession:()=>invoke('fg-session-clear'),
 request:(path,body)=>ipcRenderer.invoke('fg-request',{path,body}),state:()=>invoke('fg-state'),homeData:()=>invoke('fg-home-data'),diagnostics:()=>invoke('fg-diagnostics'),sync:()=>invoke('fg-sync'),
 checkUpdates:()=>invoke('fg-update-check'),updateNow:()=>invoke('fg-update-now'),onUpdate:callback=>{const listener=()=>callback();ipcRenderer.on('fg-update-changed',listener);return ()=>ipcRenderer.removeListener('fg-update-changed',listener);},
 printers:()=>invoke('fg-printers'),configure:p=>invoke('fg-configure',p),conflicts:()=>invoke('fg-conflicts'),resolve:(seq,choice)=>invoke('fg-resolve',{seq,choice}),
 printIntake:p=>invoke('fg-print',{...p,intake:true}),printManual:p=>invoke('fg-print',p),printContext:()=>invoke('fg-print-context'),printReady:()=>invoke('fg-print-ready'),
 onChanged:callback=>{const listener=(_event,change)=>callback(change);ipcRenderer.on('fg-changed',listener);return ()=>ipcRenderer.removeListener('fg-changed',listener);}
}));


contextBridge.exposeInMainWorld('warehouseDesktop',Object.freeze({
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
