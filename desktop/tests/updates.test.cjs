const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Updates}=require('../updates.cjs');
function setup(options={}){const updater=new EventEmitter(),calls=[];let safe=false;updater.checkForUpdates=async()=>{calls.push('check');};updater.quitAndInstall=(...args)=>calls.push(args);const updates=new Updates({updater,canInstall:async()=>safe,prepare:()=>calls.push('backup'),...options});return{updater,updates,calls,safe:()=>{safe=true;}};}
test('download never interrupts work; idle install backs up and silently relaunches once',async()=>{const x=setup();assert.equal(x.updater.autoInstallOnAppQuit,false);assert.equal(x.updater.allowDowngrade,false);x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.tick();assert.deepEqual(x.calls,[]);x.safe();await Promise.all([x.updates.tick(),x.updates.tick()]);assert.deepEqual(x.calls,['backup',[true,true]]);assert.equal(x.updates.state.status,'installing');});
test('backup failure prevents restart and leaves an error',async()=>{const x=setup();x.safe();x.updates.prepare=()=>{throw Error('Disk full');};x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.tick();assert.deepEqual(x.calls,[]);assert.equal(x.updates.state.error,'Disk full');});
test('network failure can retry without stopping the application',async()=>{const x=setup();x.updater.checkForUpdates=async()=>{throw Error('Offline');};await x.updates.check();assert.equal(x.updates.state.status,'error');x.updater.checkForUpdates=async()=>x.updater.emit('update-not-available');await x.updates.check();assert.equal(x.updates.state.status,'current');});
test('checks do not overlap or replace a downloaded update',async()=>{const x=setup();let finish;x.updater.checkForUpdates=()=>new Promise(r=>{x.calls.push('check');finish=r;});const p=x.updates.check();await x.updates.check();assert.deepEqual(x.calls,['check']);finish();await p;x.updater.emit('update-downloaded',{version:'1.0.3'});await x.updates.check();assert.deepEqual(x.calls,['check']);});
test('update now checks immediately and installs a downloaded update without the idle timer',async()=>{const x=setup();x.updates.canInstall=async immediate=>immediate;await x.updates.now();assert.deepEqual(x.calls,['check']);x.updater.emit('update-downloaded',{version:'1.0.4'});await new Promise(setImmediate);assert.deepEqual(x.calls,['check','backup',[true,true]]);});
test('update now still waits for a safe form and active printing to finish',async()=>{const x=setup();x.updater.emit('update-downloaded',{version:'1.0.4'});await x.updates.now();assert.deepEqual(x.calls,['check']);assert.equal(x.updates.state.status,'ready');x.safe();await x.updates.tick();assert.deepEqual(x.calls,['check','backup',[true,true]]);});
test('real download measurements and a specific wait reason reach the UI, then installation resumes',async()=>{
 const x=setup();x.updater.emit('update-available',{version:'1.0.14'});x.updater.emit('download-progress',{percent:37.3,transferred:37,total:100,bytesPerSecond:8});
 assert.equal(x.updates.state.progress,37);assert.equal(x.updates.state.transferred,37);assert.equal(x.updates.state.total,100);
 x.updates.canInstall=async()=>({allowed:false,reason:'Завершаем печать документа'});x.updater.emit('update-downloaded',{version:'1.0.14'});await x.updates.now();
 assert.equal(x.updates.state.waitReason,'Завершаем печать документа');assert.deepEqual(x.calls,['check']);
 x.updates.canInstall=async()=>true;await x.updates.tick();assert.deepEqual(x.calls,['check','backup',[true,true]]);assert.equal(x.updates.state.waitReason,'');
});
test('preparing a backup is awaited and cannot start a second check or installation',async()=>{
 const x=setup();x.safe();let finish;x.updates.prepare=()=>new Promise(resolve=>{finish=resolve;});x.updater.emit('update-downloaded',{version:'1.0.14'});
 const first=x.updates.tick();await new Promise(setImmediate);assert.equal(x.updates.state.status,'preparing');
 await x.updates.check();await x.updates.tick();assert.deepEqual(x.calls,[]);finish();await first;assert.deepEqual(x.calls,[[true,true]]);
});

test('failed shutdown restores UI through the error callback instead of locking it forever',async()=>{
 const updater=new EventEmitter();updater.quitAndInstall=()=>{};let locked=false;
 const updates=new Updates({updater,canInstall:async()=>{locked=true;return true;},prepare:()=>{},installTimeout:20,changed:()=>{if(updates.state.status==='error')locked=false;}});
 updater.emit('update-downloaded',{version:'1.0.21'});await updates.tick();assert.equal(locked,true);
 await new Promise(r=>setTimeout(r,40));assert.equal(updates.state.status,'error');assert.equal(locked,false);
});

test('update now discovers a newer release instead of installing the old cached version',async()=>{
 const x=setup(),info={version:'1.0.39'},token={};x.safe();
 x.updater.checkForUpdates=async()=>{x.calls.push('check');assert.equal(x.updater.autoDownload,false);x.updater.emit('checking-for-update');x.updater.emit('update-available',info);return {updateInfo:info,cancellationToken:token};};
 x.updater.downloadUpdate=received=>{assert.equal(received,token);x.calls.push('download-latest');return Promise.resolve(['latest.exe']);};
 x.updater.emit('update-downloaded',{version:'1.0.34'});await x.updates.now();
 assert.deepEqual(x.calls,['check','download-latest']);assert.equal(x.updates.state.status,'downloading');assert.equal(x.updates.state.version,'1.0.39');assert.equal(x.updater.autoDownload,true);
 x.updater.emit('update-downloaded',info);await new Promise(setImmediate);
 assert.deepEqual(x.calls,['check','download-latest','backup',[true,true]]);assert.equal(x.updates.state.version,'1.0.39');
});

test('checking an unchanged ready release keeps its verified cache without another download',async()=>{
 const x=setup();let downloads=0;
 x.updater.checkForUpdates=async()=>{x.calls.push('check');x.updater.emit('update-available',{version:'1.0.34'});return {updateInfo:{version:'1.0.34'}};};x.updater.downloadUpdate=()=>{downloads++;};
 x.updater.emit('update-downloaded',{version:'1.0.34'});await x.updates.now();
 assert.equal(x.updates.state.status,'ready');assert.equal(x.updates.state.version,'1.0.34');assert.equal(downloads,0);assert.equal(x.updater.autoDownload,true);
 x.safe();await x.updates.tick();assert.deepEqual(x.calls,['check','backup',[true,true]]);
});

test('a long-suspended ready update refreshes before idle installation, with bounded background checks',async()=>{
 let now=1000;const x=setup({now:()=>now,readyCheckInterval:900000});
 x.updater.checkForUpdates=async()=>{x.calls.push('check');x.updater.emit('update-available',{version:'1.0.34'});return {updateInfo:{version:'1.0.34'}};};
 x.updater.emit('update-downloaded',{version:'1.0.34'});now+=900001;
 await x.updates.check();await x.updates.check();assert.deepEqual(x.calls,['check']);
 now+=900001;x.updater.checkForUpdates=async()=>{x.calls.push('check');return {updateInfo:{version:'1.0.39'}};};x.updater.downloadUpdate=()=>{x.calls.push('download-latest');return Promise.resolve([]);};x.safe();await x.updates.tick();
 assert.deepEqual(x.calls,['check','check','download-latest']);assert.equal(x.updates.state.status,'downloading');
 x.updater.emit('update-downloaded',{version:'1.0.39'});await x.updates.tick();assert.deepEqual(x.calls,['check','check','download-latest','backup',[true,true]]);
});

test('concurrent update clicks and idle ticks cannot install the old cache during its metadata refresh',async()=>{
 const x=setup();let finish;x.safe();x.updater.emit('update-downloaded',{version:'1.0.34'});
 x.updater.checkForUpdates=()=>new Promise(resolve=>{x.calls.push('check');finish=resolve;});
 const first=x.updates.now();await new Promise(setImmediate);await x.updates.now();await x.updates.tick();assert.deepEqual(x.calls,['check']);
 finish({updateInfo:{version:'1.0.34'}});await first;assert.deepEqual(x.calls,['check','backup',[true,true]]);
});

test('an offline metadata refresh retains the verified cache and allows safe offline installation',async()=>{
 const x=setup();x.updater.emit('update-downloaded',{version:'1.0.34'});
 x.updater.checkForUpdates=async()=>{x.calls.push('check');const error=Error('Offline');x.updater.emit('error',error);throw error;};
 await x.updates.now();assert.equal(x.updates.state.status,'ready');assert.equal(x.updates.state.version,'1.0.34');assert.equal(x.updates.state.error,'Offline');assert.equal(x.updater.autoDownload,true);
 x.safe();await x.updates.tick();assert.deepEqual(x.calls,['check','backup',[true,true]]);
});

test('a failed replacement download never installs the superseded cached release',async()=>{
 const x=setup();x.safe();x.updater.emit('update-downloaded',{version:'1.0.34'});
 x.updater.checkForUpdates=async()=>({updateInfo:{version:'1.0.39'}});x.updater.downloadUpdate=()=>Promise.reject(Error('Replacement checksum failed'));
 await x.updates.now();await new Promise(setImmediate);await x.updates.tick();assert.equal(x.updates.state.status,'error');assert.match(x.updates.state.error,/checksum/);assert.deepEqual(x.calls,[]);
});

test('download progress storms keep current measurements while batching renderer notifications',async()=>{
 let notifications=0;const x=setup({changed:()=>{notifications++;},progressInterval:20,now:()=>1000});
 x.updater.emit('update-available',{version:'1.0.39'});
 for(let transferred=1;transferred<=1000;transferred++)x.updater.emit('download-progress',{percent:transferred/10,transferred,total:1000,bytesPerSecond:500});
 assert.equal(x.updates.state.transferred,1000);assert.equal(notifications,2);
 await new Promise(resolve=>setTimeout(resolve,40));assert.equal(notifications,3);
 x.updater.emit('update-downloaded',{version:'1.0.39'});assert.equal(notifications,4);assert.equal(x.updates.state.status,'ready');
 x.updater.emit('download-progress',{percent:99,transferred:999,total:1000,bytesPerSecond:1});await new Promise(resolve=>setTimeout(resolve,40));
 assert.equal(x.updates.state.status,'ready');assert.equal(x.updates.state.progress,100);assert.equal(notifications,4);
});

test('late download progress does not erase a failure or make a broken update look active',()=>{
 const x=setup();x.updater.emit('update-available',{version:'1.0.39'});x.updater.emit('error',Error('Download checksum failed'));
 x.updater.emit('download-progress',{percent:100,transferred:100,total:100,bytesPerSecond:1});assert.equal(x.updates.state.status,'error');assert.match(x.updates.state.error,/checksum/);
});
