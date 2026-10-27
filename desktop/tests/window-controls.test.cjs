const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const {registerWindowControls}=require('../../warehouse-desktop/window-controls.cjs');
function fixture({eventFirst=false,deferred=false}={}){
 const handlers=new Map(),win=new EventEmitter(),contents=new EventEmitter(),calls=[],sent=[];
 const transitions=[];
 let fullscreen=false,maximized=false,minimized=false,destroyed=false;
 contents.mainFrame={url:'fastgo://app/workshop.html#home'};contents.isDestroyed=()=>false;contents.send=(...args)=>{sent.push(args);contents.emit('published',args[1]);};win.webContents=contents;
 win.isDestroyed=()=>destroyed;win.isFullScreen=()=>fullscreen;win.isMaximized=()=>maximized;win.isMinimized=()=>minimized;
 const complete=(target,{propertyFirst=!eventFirst}={})=>{if(propertyFirst)fullscreen=target;win.emit(target?'enter-full-screen':'leave-full-screen');if(!propertyFirst)fullscreen=target;};
 win.setFullScreen=value=>{calls.push(['fullscreen',value]);if(deferred)transitions.push(value);else complete(value);};
 win.minimize=()=>{calls.push(['minimize']);minimized=true;win.emit('minimize');};
 win.maximize=()=>{calls.push(['maximize']);maximized=true;win.emit('maximize');};win.unmaximize=()=>{calls.push(['unmaximize']);maximized=false;win.emit('unmaximize');};win.close=()=>calls.push(['close']);
 const controls=registerWindowControls({ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},getWindow:()=>win});controls.attach(win);
 const event={sender:contents,senderFrame:contents.mainFrame},state=()=>handlers.get('fastgo-window:state')(event),command=action=>handlers.get('fastgo-window:command')(event,action);
 const key=input=>{let prevented=false;contents.emit('before-input-event',{preventDefault:()=>prevented=true},{type:'keyDown',...input});return prevented;};
 const published=predicate=>new Promise(resolve=>{const listener=state=>{if(predicate(state)){contents.removeListener('published',listener);resolve(state);}};contents.on('published',listener);});
 return {win,contents,handlers,calls,sent,event,state,command,key,published,transitions,completeNext:options=>{assert(transitions.length);complete(transitions.shift(),options);},setPhysical:value=>fullscreen=value,destroy:()=>destroyed=true};
}
test('registration preserves ordinary startup and publishes confirmed native fullscreen changes',async()=>{
 const x=fixture();assert.deepEqual(x.calls,[]);assert.deepEqual(x.state(),{fullscreen:false,maximized:false,minimized:false,revision:0});
 assert.equal((await x.command('toggle-fullscreen')).fullscreen,true);assert.deepEqual(x.sent.at(-1),['fastgo-window:changed',{fullscreen:true,maximized:false,minimized:false,revision:1}]);
 assert.equal((await x.command('exit-fullscreen')).fullscreen,false);await x.command('exit-fullscreen');assert.equal(x.calls.length,2);
});
test('F11 toggles once per press without consuming other shortcuts or repeated keydown',async()=>{
 const x=fixture(),entered=x.published(s=>s.fullscreen);assert.equal(x.key({key:'F11'}),true);await entered;assert.equal(x.state().fullscreen,true);
 assert.equal(x.key({key:'F11',isAutoRepeat:true}),true);assert.equal(x.state().fullscreen,true);
 for(const input of [{key:'F11',type:'keyUp'},{key:'F11',control:true},{key:'F5'},{key:'Escape'}])assert.equal(x.key(input),false);
 assert.equal(x.calls.length,1);const left=x.published(s=>!s.fullscreen);x.key({key:'F11'});await left;assert.equal(x.state().fullscreen,false);
});
test('fullscreen controls preserve maximize state and use ordinary minimize/close methods',async()=>{
 const x=fixture();await x.command('restore');assert.equal(x.state().maximized,true);await x.command('toggle-fullscreen');await x.command('restore');assert.equal(x.state().fullscreen,false);assert.equal(x.state().maximized,true);
 await x.command('restore');assert.equal(x.state().maximized,false);x.command('minimize');x.command('close');assert.deepEqual(x.calls.slice(-2),[['minimize'],['close']]);
 assert.throws(()=>x.command('destroy'),/Неизвестная команда/);
});
test('another window, a subframe, and a remote main frame cannot control the app',async()=>{
 const x=fixture(),command=x.handlers.get('fastgo-window:command');
 for(const event of [{...x.event,sender:{}},{...x.event,senderFrame:{url:x.contents.mainFrame.url}}])assert.throws(()=>command(event,'close'),/Недоверенное окно/);
 x.contents.mainFrame.url='https://example.com/warehouse.html';assert.throws(()=>command(x.event,'close'),/Недоверенное окно/);assert.deepEqual(x.calls,[]);
 x.contents.mainFrame.url='fastgo://app/warehouse.html?unified=1';assert.equal((await x.command('toggle-fullscreen')).fullscreen,true);
 x.destroy();assert.throws(()=>x.state(),/Окно недоступно/);
});
test('Windows events before the property flip publish correct state and command replies',async()=>{
 const x=fixture({eventFirst:true}),physicalAtEvent=[];x.win.on('enter-full-screen',()=>physicalAtEvent.push(x.win.isFullScreen()));x.win.on('leave-full-screen',()=>physicalAtEvent.push(x.win.isFullScreen()));
 const enter=await x.command('toggle-fullscreen');assert.equal(enter.fullscreen,true);assert.equal(x.win.isFullScreen(),true);assert.equal(x.state().fullscreen,true);
 const leave=await x.command('exit-fullscreen');assert.equal(leave.fullscreen,false);assert.equal(x.win.isFullScreen(),false);assert.equal(x.state().fullscreen,false);
 assert.deepEqual(physicalAtEvent,[false,true]);assert.deepEqual(x.sent.map(([,s])=>s.fullscreen),[true,false]);assert.deepEqual(x.sent.map(([,s])=>s.revision),[1,2]);
});
test('deferred native transitions confirm before replying and serialize rapid toggles',async()=>{
 const x=fixture({deferred:true,eventFirst:true}),first=x.command('toggle-fullscreen'),second=x.command('toggle-fullscreen');let confirmed=false;first.then(()=>confirmed=true);
 await Promise.resolve();await Promise.resolve();assert.equal(confirmed,false);assert.equal(x.state().fullscreen,false);assert.deepEqual(x.calls,[['fullscreen',true]]);
 x.completeNext();assert.equal((await first).fullscreen,true);await Promise.resolve();await Promise.resolve();assert.deepEqual(x.calls,[['fullscreen',true],['fullscreen',false]]);
 x.completeNext();assert.equal((await second).fullscreen,false);assert.equal(x.state().fullscreen,false);assert.equal(x.win.isFullScreen(),false);
});
test('property-first transitions remain unconfirmed until the native event',async()=>{
 const x=fixture({deferred:true}),pending=x.command('toggle-fullscreen');await Promise.resolve();await Promise.resolve();x.setPhysical(true);assert.equal(x.win.isFullScreen(),true);assert.equal(x.state().fullscreen,false);
 x.completeNext({propertyFirst:true});const result=await pending;assert.equal(result.fullscreen,true);assert.equal(result.revision,1);
});
test('renderer converges on confirmed state and rejects delayed IPC replies',async()=>{
 const {windowStateUpdates}=await import(pathToFileURL(path.resolve(__dirname,'../../warehouse/window-controls.js')).href),x=fixture({eventFirst:true});let view;
 const update=windowStateUpdates(s=>view=s),initial=x.state();update(initial);const oldReply=await x.command('toggle-fullscreen');x.sent.forEach(([,s])=>update(s));const leave=await x.command('exit-fullscreen');update(leave);const latest=await x.command('toggle-fullscreen');update(latest);
 assert.equal(update(oldReply),false);assert.equal(update(initial),false);assert.equal(update({fullscreen:false}),false);assert.equal(view.fullscreen,true);assert.deepEqual(view,x.state());assert.equal(view.revision,3);
});
for(const file of ['../preload.cjs','../../warehouse-desktop/warehouse-preload.cjs'])test('sandbox preload exposes bounded window IPC: '+file,async()=>{
 const exposed={},events=new EventEmitter(),calls=[],ipcRenderer={invoke:async(...args)=>{calls.push(args);return {fullscreen:true};},on:events.on.bind(events),removeListener:events.removeListener.bind(events)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(key,value)=>exposed[key]=value},ipcRenderer};},window:{addEventListener(){}}});
 assert(Object.isFrozen(exposed.fastgoWindow));assert.equal((await exposed.fastgoWindow.state()).fullscreen,true);await exposed.fastgoWindow.command('exit-fullscreen');assert.deepEqual(calls,[['fastgo-window:state'],['fastgo-window:command','exit-fullscreen']]);
 let seen=0;const stop=exposed.fastgoWindow.onChanged(state=>{assert.equal(state.fullscreen,false);seen++;});events.emit('fastgo-window:changed',{secretEvent:'not forwarded'},{fullscreen:false});stop();events.emit('fastgo-window:changed',{},{});assert.equal(seen,1);
});
