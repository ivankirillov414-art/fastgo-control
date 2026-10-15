const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('terminalUSB',{devices:()=>ipcRenderer.invoke('terminal:devices'),install:serial=>ipcRenderer.invoke('terminal:install',serial)});
