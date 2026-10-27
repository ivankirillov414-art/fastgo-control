// Only the trusted main window may control its native frame. Registration never
// changes startup visibility, size, or fullscreen state.
function registerWindowControls({ipcMain,getWindow}){
 const current=()=>{const win=getWindow();if(!win||win.isDestroyed())throw Error('Окно недоступно');return win;};
 const state=win=>({fullscreen:win.isFullScreen(),maximized:win.isMaximized(),minimized:win.isMinimized()});
 const trusted=event=>{const win=current();if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!/^fastgo:\/\/app\/(workshop|warehouse)\.html(?:[?#]|$)/.test(event.senderFrame?.url||''))throw Error('Недоверенное окно');return win;};
 const command=(win,action)=>{
  switch(action){
   case 'toggle-fullscreen':win.setFullScreen(!win.isFullScreen());break;
   case 'exit-fullscreen':if(win.isFullScreen())win.setFullScreen(false);break;
   case 'minimize':win.minimize();break;
   case 'restore':if(win.isFullScreen())win.setFullScreen(false);else if(win.isMaximized())win.unmaximize();else win.maximize();break;
   case 'close':win.close();break;
   default:throw Error('Неизвестная команда окна');
  }
  return win.isDestroyed()?null:state(win);
 };
 ipcMain.handle('fastgo-window:state',event=>state(trusted(event)));
 ipcMain.handle('fastgo-window:command',(event,action)=>command(trusted(event),action));
 return {attach(win){
  const changed=()=>{if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('fastgo-window:changed',state(win));};
  for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize','minimize','restore'])win.on(event,changed);
  win.webContents.on('before-input-event',(event,input)=>{
   if(input.type==='keyDown'&&input.key==='F11'&&!input.control&&!input.meta&&!input.alt){event.preventDefault();if(!input.isAutoRepeat)command(win,'toggle-fullscreen');}
  });
 }};
}
module.exports={registerWindowControls};
