// Only the trusted main window may control its native frame. Registration never
// changes startup visibility, size, or fullscreen state.
function registerWindowControls({ipcMain,getWindow}){
 const windows=new WeakMap();
 const current=()=>{const win=getWindow();if(!win||win.isDestroyed())throw Error('Окно недоступно');return win;};
 const record=win=>{let value=windows.get(win);if(!value){value={fullscreen:win.isFullScreen(),maximized:win.isMaximized(),minimized:win.isMinimized(),revision:0,queue:Promise.resolve(),pending:null};windows.set(win,value);}return value;};
 const state=win=>{const value=record(win);return {fullscreen:value.fullscreen,maximized:value.maximized,minimized:value.minimized,revision:value.revision};};
 const trusted=event=>{const win=current();if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!/^fastgo:\/\/app\/(workshop|warehouse)\.html(?:[?#]|$)/.test(event.senderFrame?.url||''))throw Error('Недоверенное окно');return win;};
 const fullscreen=(win,target)=>{
  const value=record(win);if(value.fullscreen===target)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const finish=error=>{if(value.pending!==pending)return;clearTimeout(pending.timer);value.pending=null;error?reject(error):resolve();};
   const pending={target,finish,timer:setTimeout(()=>finish(Error('Окно не подтвердило изменение полноэкранного режима')),8000)};value.pending=pending;
   try{win.setFullScreen(target);}catch(error){finish(error);}
  });
 };
 const enqueue=(win,action)=>{const value=record(win),next=value.queue.catch(()=>{}).then(async()=>{if(win.isDestroyed())throw Error('Окно недоступно');await action(value);return state(win);});value.queue=next;return next;};
 const command=(win,action)=>{
  switch(action){
   case 'toggle-fullscreen':return enqueue(win,value=>fullscreen(win,!value.fullscreen));
   case 'exit-fullscreen':return enqueue(win,()=>fullscreen(win,false));
   case 'minimize':win.minimize();break;
   case 'restore':return enqueue(win,value=>{if(value.fullscreen)return fullscreen(win,false);if(value.maximized)win.unmaximize();else win.maximize();});
   case 'close':win.close();break;
   default:throw Error('Неизвестная команда окна');
  }
  return win.isDestroyed()?null:state(win);
 };
 ipcMain.handle('fastgo-window:state',event=>state(trusted(event)));
 ipcMain.handle('fastgo-window:command',(event,action)=>command(trusted(event),action));
 return {attach(win){
  const value=record(win);
  const changed=patch=>{
   Object.assign(value,patch);value.revision++;
   if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('fastgo-window:changed',state(win));
   if(Object.hasOwn(patch,'fullscreen')&&value.pending?.target===value.fullscreen)value.pending.finish();
  };
  // Windows emits these notifications before isFullScreen() flips. The event
  // itself is authoritative; re-reading the property here publishes stale state.
  for(const [event,patch]of [['enter-full-screen',{fullscreen:true}],['leave-full-screen',{fullscreen:false}],['maximize',{maximized:true}],['unmaximize',{maximized:false}],['minimize',{minimized:true}],['restore',{minimized:false}]])win.on(event,()=>changed(patch));
  win.on('closed',()=>value.pending?.finish(Error('Окно закрыто')));
  win.webContents.on('before-input-event',(event,input)=>{
   if(input.type==='keyDown'&&input.key==='F11'&&!input.control&&!input.meta&&!input.alt){event.preventDefault();if(!input.isAutoRepeat)void command(win,'toggle-fullscreen').catch(()=>{});}
  });
 }};
}
module.exports={registerWindowControls};
