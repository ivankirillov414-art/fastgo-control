const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('fastgoNetwork',Object.freeze({status:()=>ipcRenderer.invoke('warehouse-network:status'),probe:()=>ipcRenderer.invoke('warehouse-network:probe'),save:()=>ipcRenderer.invoke('warehouse-network:save')}));
