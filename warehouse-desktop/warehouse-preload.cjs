const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('warehouseDesktop',Object.freeze({
 openTerminalUpdater:()=>ipcRenderer.invoke('terminal:open')
}));
