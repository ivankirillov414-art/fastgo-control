const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {registerWindowControls}=require('../../warehouse-desktop/window-controls.cjs');
function fixture(){
 const handlers=new Map(),win=new EventEmitter(),contents=new EventEmitter(),calls=[],sent=[];
 let fullscreen=false,maximized=false,minimized=false,destroyed=false;
 contents.mainFrame={url:'fastgo://app/workshop.html#home'};contents.isDestroyed=()=>false;contents.send=(...args)=>sent.push(args);win.webContents=contents;
 win.isDestroyed=()=>destroyed;win.isFullScreen=()=>fullscreen;win.isMaximized=()=>maximized;win.isMinimized=()=>minimized;
 win.setFullScreen=value=>{calls.push(['fullscreen',value]);fullscreen=value;win.emit(value?'enter-full-screen':'leave-full-screen');};
 win.minimize=()=>{calls.push(['minimize']);minimized=true;win.emit('minimize');};
 win.maximize=()=>{calls.push(['maximize']);maximized=true;win.emit('maximize');};win.unmaximize=()=>{calls.push(['unmaximize']);maximized=false;win.emit('unmaximize');};win.close=()=>calls.push(['close']);
 const controls=registerWindowControls({ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},getWindow:()=>win});controls.attach(win);
 const event={sender:contents,senderFrame:contents.mainFrame},state=()=>handlers.get('fastgo-window:state')(event),command=action=>handlers.get('fastgo-window:command')(event,action);
 const key=input=>{let prevented=false;contents.emit('before-input-event',{preventDefault:()=>prevented=true},{type:'keyDown',...input});return prevented;};
 return {win,contents,handlers,calls,sent,event,state,command,key,destroy:()=>destroyed=true};
}
test('registration preserves ordinary startup and publishes actual native fullscreen changes',()=>{
 const x=fixture();assert.deepEqual(x.calls,[]);assert.deepEqual(x.state(),{fullscreen:false,maximized:false,minimized:false});
 assert.equal(x.command('toggle-fullscreen').fullscreen,true);assert.deepEqual(x.sent.at(-1),['fastgo-window:changed',{fullscreen:true,maximized:false,minimized:false}]);
 assert.equal(x.command('exit-fullscreen').fullscreen,false);x.command('exit-fullscreen');assert.equal(x.calls.length,2);
});
test('F11 toggles once per press without consuming other shortcuts or repeated keydown',()=>{
 const x=fixture();assert.equal(x.key({key:'F11'}),true);assert.equal(x.state().fullscreen,true);
 assert.equal(x.key({key:'F11',isAutoRepeat:true}),true);assert.equal(x.state().fullscreen,true);
 for(const input of [{key:'F11',type:'keyUp'},{key:'F11',control:true},{key:'F5'},{key:'Escape'}])assert.equal(x.key(input),false);
 assert.equal(x.calls.length,1);x.key({key:'F11'});assert.equal(x.state().fullscreen,false);
});
test('fullscreen controls preserve maximize state and use ordinary minimize/close methods',()=>{
 const x=fixture();x.command('restore');assert.equal(x.state().maximized,true);x.command('toggle-fullscreen');x.command('restore');assert.equal(x.state().fullscreen,false);assert.equal(x.state().maximized,true);
 x.command('restore');assert.equal(x.state().maximized,false);x.command('minimize');x.command('close');assert.deepEqual(x.calls.slice(-2),[['minimize'],['close']]);
 assert.throws(()=>x.command('destroy'),/Неизвестная команда/);
});
test('another window, a subframe, and a remote main frame cannot control the app',()=>{
 const x=fixture(),command=x.handlers.get('fastgo-window:command');
 for(const event of [{...x.event,sender:{}},{...x.event,senderFrame:{url:x.contents.mainFrame.url}}])assert.throws(()=>command(event,'close'),/Недоверенное окно/);
 x.contents.mainFrame.url='https://example.com/warehouse.html';assert.throws(()=>command(x.event,'close'),/Недоверенное окно/);assert.deepEqual(x.calls,[]);
 x.contents.mainFrame.url='fastgo://app/warehouse.html?unified=1';assert.equal(x.command('toggle-fullscreen').fullscreen,true);
 x.destroy();assert.throws(()=>x.state(),/Окно недоступно/);
});
for(const file of ['../preload.cjs','../../warehouse-desktop/warehouse-preload.cjs'])test('sandbox preload exposes bounded window IPC: '+file,async()=>{
 const exposed={},events=new EventEmitter(),calls=[],ipcRenderer={invoke:async(...args)=>{calls.push(args);return {fullscreen:true};},on:events.on.bind(events),removeListener:events.removeListener.bind(events)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(key,value)=>exposed[key]=value},ipcRenderer};},window:{addEventListener(){}}});
 assert(Object.isFrozen(exposed.fastgoWindow));assert.equal((await exposed.fastgoWindow.state()).fullscreen,true);await exposed.fastgoWindow.command('exit-fullscreen');assert.deepEqual(calls,[['fastgo-window:state'],['fastgo-window:command','exit-fullscreen']]);
 let seen=0;const stop=exposed.fastgoWindow.onChanged(state=>{assert.equal(state.fullscreen,false);seen++;});events.emit('fastgo-window:changed',{secretEvent:'not forwarded'},{fullscreen:false});stop();events.emit('fastgo-window:changed',{},{});assert.equal(seen,1);
});
