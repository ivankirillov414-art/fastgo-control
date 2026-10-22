const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('printing runs while database synchronization remains pending',async()=>{
 const timers=[],calls={sync:0,local:0,remote:0};
 const electron={app:{setName(){},requestSingleInstanceLock:()=>true,whenReady:()=>({then(){}}),on(){}},protocol:{registerSchemesAsPrivileged(){}}};
 const context=vm.createContext({require:name=>name==='electron'?electron:name==='./store.cjs'?{}:name==='./sync.cjs'?{}:name==='./warehouse-station.cjs'?{}:name==='./warehouse-runtime.cjs'?{}:name==='./updates.cjs'?require('../updates.cjs'):require(name),__dirname:path.resolve(__dirname,'..'),setInterval:(fn,ms)=>timers.push({fn,ms}),calls});
 const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
 vm.runInContext(source,context);
 // Execute the production scheduler declarations with a stalled upload.
 vm.runInContext("actor='test';sync={run:()=>{calls.sync++;return new Promise(()=>{});}};localPrints=async()=>{calls.local++;};pollPrint=async()=>{calls.remote++;};",context);
 const scheduling=source.slice(source.indexOf(' // Never put printing'),source.indexOf(' setInterval(()=>{if(actor&&!warming)'));
 vm.runInContext(scheduling,context);
 assert.equal(timers.length,2);
 timers.find(x=>x.ms===5000).fn();
 for(let i=0;i<3;i++)timers.find(x=>x.ms===1000).fn();
 assert.deepEqual(calls,{sync:1,local:3,remote:3});
});
test('an update drains existing print polling and resumes it when the user opens a form',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
 const electron={app:{setName(){},requestSingleInstanceLock:()=>true,whenReady:()=>({then(){}}),on(){}},protocol:{registerSchemesAsPrivileged(){}}};
 const context=vm.createContext({require:name=>name==='electron'?electron:name==='./store.cjs'||name==='./sync.cjs'?{}:name==='./warehouse-station.cjs'?{}:name==='./warehouse-runtime.cjs'?{}:name==='./updates.cjs'?require('../updates.cjs'):require(name),__dirname:path.resolve(__dirname,'..')});
 vm.runInContext(source,context);
 vm.runInContext("win={isDestroyed:()=>false,webContents:{executeJavaScript:async source=>source.includes('BlockReason')?'':true}};store={db:{prepare:()=>({get:()=>true})}};sync={busy:false};remoteBusy=true;",context);
 const start=source.indexOf('canInstall:async immediate=>')+'canInstall:'.length,end=source.indexOf(',prepare:()=>',start);
 const canInstall=vm.runInContext('('+source.slice(start,end)+')',context);
 assert.equal((await canInstall(true)).reason,'Завершаем запрос к очереди печати');assert.equal(vm.runInContext('updateDraining',context),true);
 // Do not claim more queued local jobs while the current operation drains.
 vm.runInContext("actor='test';store.setting=()=>{throw Error('Read the print queue during update drain');}",context);
 await vm.runInContext('localPrints()',context);
 vm.runInContext('remoteBusy=false',context);assert.equal(await canInstall(true),true);
 vm.runInContext("win.webContents.executeJavaScript=async()=>'Сохраните изменения'",context);assert.equal((await canInstall(true)).allowed,false);assert.equal(vm.runInContext('updateDraining',context),false);
});
