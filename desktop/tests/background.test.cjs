const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {createBackground}=require('../../warehouse-desktop/background.cjs');
function fixture(t,preferred=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-background-')),app=new EventEmitter(),window=new EventEmitter(),image={resize(){return this;},isEmpty:()=>false},calls=[];
 app.isPackaged=true;app.getPath=k=>k==='exe'?path.join(root,'FastGo.exe'):root;app.getName=()=> 'FastGo';app.setLoginItemSettings=s=>calls.push(s);app.quit=()=>{app.emit('before-quit');calls.push('quit');};
 window.isDestroyed=()=>false;window.isMinimized=()=>true;window.restore=()=>calls.push('restore');window.show=()=>calls.push('show');window.focus=()=>calls.push('focus');window.hide=()=>calls.push('hide');window.isVisible=()=>false;
 class Tray extends EventEmitter{constructor(){super();calls.tray=this;}setToolTip(){}setContextMenu(menu){this.menu=menu;}destroy(){calls.push('destroy');}}
 const primary=path.join(root,'primary.exe');if(preferred)fs.writeFileSync(primary,'test');
 const options={app,getWindow:()=>window,Tray,Menu:{buildFromTemplate:x=>x},nativeImage:{createFromPath:()=>image},icon:'test',checkUpdates:()=>calls.push('check'),preferredExecutable:preferred?primary:undefined,platform:'win32'};
 t.after(()=>{for(const name of ['background-start-configured.json','primary.exe'])if(fs.existsSync(path.join(root,name)))fs.unlinkSync(path.join(root,name));fs.rmdirSync(root);});
 return{app,window,calls,options};
}
test('window close preserves the background client; explicit exit permits a real quit',t=>{
 const x=fixture(t),bg=createBackground(x.options);bg.attach(x.window);let prevented=false;x.window.emit('close',{preventDefault:()=>{prevented=true;}});assert.equal(prevented,true);assert.ok(x.calls.includes('hide'));
 x.calls.tray.menu.find(m=>m.label?.startsWith('Выход')).click();prevented=false;x.window.emit('close',{preventDefault:()=>{prevented=true;}});assert.equal(prevented,false);assert.ok(x.calls.includes('quit'));bg.stop();
});
test('startup is registered once, preserving a later Windows startup preference',t=>{
 const x=fixture(t);createBackground(x.options).stop();createBackground(x.options).stop();const settings=x.calls.filter(c=>typeof c==='object');assert.equal(settings.length,1);assert.equal(settings[0].openAtLogin,true);assert.deepEqual(settings[0].args,['--background']);
});
test('standalone warehouse does not take startup away from an installed unified app',t=>{
 const x=fixture(t,true);createBackground(x.options).stop();assert.equal(x.calls.filter(c=>typeof c==='object').length,0);
});
test('installer quit is not intercepted as a hide operation',t=>{
 const x=fixture(t),bg=createBackground(x.options);bg.attach(x.window);x.app.emit('before-quit');let prevented=false;x.window.emit('close',{preventDefault:()=>{prevented=true;}});assert.equal(prevented,false);bg.stop();
});
