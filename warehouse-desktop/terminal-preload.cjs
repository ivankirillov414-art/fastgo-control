const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('terminalUSB',{installNative:serial=>ipcRenderer.invoke('terminal:installNative',serial),devices:()=>ipcRenderer.invoke('terminal:devices'),install:serial=>ipcRenderer.invoke('terminal:install',serial)});
