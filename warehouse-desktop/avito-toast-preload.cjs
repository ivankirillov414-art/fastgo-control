const {ipcRenderer}=require('electron');
window.addEventListener('DOMContentLoaded',()=>{document.body.addEventListener('click',()=>ipcRenderer.send('warehouse:notificationOpen'));document.getElementById('close')?.addEventListener('click',event=>{event.stopPropagation();ipcRenderer.send('warehouse:notificationClose');});});
