const {contextBridge,ipcRenderer}=require('electron');
const invoke=(channel,...args)=>ipcRenderer.invoke(channel,...args).then(value=>{if(value?.__desktopError)throw Error(value.message);return value;});
contextBridge.exposeInMainWorld('fastgoDesktop',Object.freeze({
 version:'1.0.5',getSession:()=>invoke('fg-session-get'),saveSession:s=>invoke('fg-session-save',s),clearSession:()=>invoke('fg-session-clear'),
 request:(path,body)=>ipcRenderer.invoke('fg-request',{path,body}),state:()=>invoke('fg-state'),sync:()=>invoke('fg-sync'),
 checkUpdates:()=>invoke('fg-update-check'),updateNow:()=>invoke('fg-update-now'),onUpdate:callback=>{const listener=()=>callback();ipcRenderer.on('fg-update-changed',listener);return ()=>ipcRenderer.removeListener('fg-update-changed',listener);},
 printers:()=>invoke('fg-printers'),configure:p=>invoke('fg-configure',p),conflicts:()=>invoke('fg-conflicts'),resolve:(seq,choice)=>invoke('fg-resolve',{seq,choice}),
 printIntake:p=>invoke('fg-print',{...p,intake:true}),printManual:p=>invoke('fg-print',p),printContext:()=>invoke('fg-print-context'),printReady:()=>invoke('fg-print-ready'),
 onChanged:callback=>{const listener=(_event,change)=>callback(change);ipcRenderer.on('fg-changed',listener);return ()=>ipcRenderer.removeListener('fg-changed',listener);}
}));
