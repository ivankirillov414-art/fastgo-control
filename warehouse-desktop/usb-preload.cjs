const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('usbScanner',Object.freeze({devices:()=>ipcRenderer.invoke('usb:devices'),status:()=>ipcRenderer.invoke('usb:status'),start:serial=>ipcRenderer.invoke('usb:start',serial),stop:()=>ipcRenderer.invoke('usb:stop')}));
