const fs=require('node:fs'),path=require('node:path');

// Keep the scanner handoff and safe updater alive after closing the main window.
// Explicit Exit and installer restarts still quit normally.
function createBackground({app,getWindow,Tray,Menu,nativeImage,icon,checkUpdates,preferredExecutable,platform=process.platform}){
 let quitting=false,tray=null;
 if(!app.isPackaged||platform!=='win32')return {attach(){},stop(){}};
 const show=()=>{const win=getWindow();if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();};
 try{
  const marker=path.join(app.getPath('userData'),'background-start-configured.json');
  // The unified app owns automatic startup when both products are installed.
  if((!preferredExecutable||!fs.existsSync(preferredExecutable))&&!fs.existsSync(marker)){
   app.setLoginItemSettings({openAtLogin:true,path:app.getPath('exe'),args:['--background']});
   fs.writeFileSync(marker,JSON.stringify({configured:true,at:new Date().toISOString()}));
  }
 }catch{}
 try{
  const image=nativeImage.createFromPath(icon).resize({width:20,height:20});
  if(!image.isEmpty()){
   tray=new Tray(image);tray.setToolTip(app.getName());tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Открыть '+app.getName(),click:show},
    {label:'Проверить обновления',click:()=>{void Promise.resolve().then(checkUpdates).catch(()=>{});}},
    {type:'separator'},
    {label:'Выход из '+app.getName(),click:()=>{quitting=true;app.quit();}}
   ]));tray.on('double-click',show);
  }
 }catch{}
 app.on('before-quit',()=>{quitting=true;});
 return {
  attach(win){if(!tray&&!win.isVisible())win.show();win.on('close',event=>{if(quitting||!tray)return;event.preventDefault();win.hide();});},
  stop(){quitting=true;tray?.destroy();tray=null;}
 };
}
module.exports={createBackground};
