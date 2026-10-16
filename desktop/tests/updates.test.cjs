const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Updates}=require('../updates.cjs');
function setup(){const updater=new EventEmitter(),calls=[];let safe=false;updater.checkForUpdates=async()=>{calls.push('check');};updater.quitAndInstall=(...args)=>calls.push(args);const updates=new Updates({updater,canInstall:async()=>safe,prepare:()=>calls.push('backup')});return{updater,updates,calls,safe:()=>{safe=true;}};}
test('download never interrupts work; idle install backs up and silently relaunches once',async()=>{const x=setup();assert.equal(x.updater.autoInstallOnAppQuit,false);assert.equal(x.updater.allowDowngrade,false);x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.tick();assert.deepEqual(x.calls,[]);x.safe();await Promise.all([x.updates.tick(),x.updates.tick()]);assert.deepEqual(x.calls,['backup',[true,true]]);assert.equal(x.updates.state.status,'installing');});
test('backup failure prevents restart and leaves an error',async()=>{const x=setup();x.safe();x.updates.prepare=()=>{throw Error('Disk full');};x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.tick();assert.deepEqual(x.calls,[]);assert.equal(x.updates.state.error,'Disk full');});
test('network failure can retry without stopping the application',async()=>{const x=setup();x.updater.checkForUpdates=async()=>{throw Error('Offline');};await x.updates.check();assert.equal(x.updates.state.status,'error');x.updater.checkForUpdates=async()=>x.updater.emit('update-not-available');await x.updates.check();assert.equal(x.updates.state.status,'current');});
test('checks do not overlap or replace a downloaded update',async()=>{const x=setup();let finish;x.updater.checkForUpdates=()=>new Promise(r=>{x.calls.push('check');finish=r;});const p=x.updates.check();await x.updates.check();assert.deepEqual(x.calls,['check']);finish();await p;x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.check();assert.deepEqual(x.calls,['check']);});
test('update now checks immediately and installs a downloaded update without the idle timer',async()=>{const x=setup();x.updates.canInstall=async immediate=>immediate;await x.updates.now();assert.deepEqual(x.calls,['check']);x.updater.emit('update-downloaded',{version:'1.0.4'});await new Promise(setImmediate);assert.deepEqual(x.calls,['check','backup',[true,true]]);});
test('update now still waits for a safe form and active printing to finish',async()=>{const x=setup();x.updater.emit('update-downloaded',{version:'1.0.4'});await x.updates.now();assert.deepEqual(x.calls,[]);assert.equal(x.updates.state.status,'ready');x.safe();await x.updates.tick();assert.deepEqual(x.calls,['backup',[true,true]]);});
test('real download measurements and a specific wait reason reach the UI, then installation resumes',async()=>{
 const x=setup();x.updater.emit('update-available',{version:'1.0.14'});x.updater.emit('download-progress',{percent:37.3,transferred:37,total:100,bytesPerSecond:8});
 assert.equal(x.updates.state.progress,37);assert.equal(x.updates.state.transferred,37);assert.equal(x.updates.state.total,100);
 x.updates.canInstall=async()=>({allowed:false,reason:'Завершаем печать документа'});x.updater.emit('update-downloaded',{version:'1.0.14'});await x.updates.now();
 assert.equal(x.updates.state.waitReason,'Завершаем печать документа');assert.deepEqual(x.calls,[]);
 x.updates.canInstall=async()=>true;await x.updates.tick();assert.deepEqual(x.calls,['backup',[true,true]]);assert.equal(x.updates.state.waitReason,'');
});
test('preparing a backup is awaited and cannot start a second check or installation',async()=>{
 const x=setup();x.safe();let finish;x.updates.prepare=()=>new Promise(resolve=>{finish=resolve;});x.updater.emit('update-downloaded',{version:'1.0.14'});
 const first=x.updates.tick();await new Promise(setImmediate);assert.equal(x.updates.state.status,'preparing');
 await x.updates.check();await x.updates.tick();assert.deepEqual(x.calls,[]);finish();await first;assert.deepEqual(x.calls,[[true,true]]);
});
