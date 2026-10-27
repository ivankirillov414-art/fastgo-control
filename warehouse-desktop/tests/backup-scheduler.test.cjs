const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {BackupScheduler}=require('../backup-scheduler.cjs'),{Updates}=require('../../desktop/updates.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('a downloaded update waiting on a document does not suspend backup replicas',async()=>{
 let copies=0;const update={state:{status:'ready',waitReason:'Открыт документ'},installing:false};
 const scheduler=new BackupScheduler({update:()=>update,copy:async()=>copies++});
 assert.equal(await scheduler.tick(),true);assert.equal(await scheduler.tick(),true);assert.equal(copies,2);
 for(const state of [{state:{status:'preparing'}},{state:{status:'installing'}},{state:{status:'ready'},installing:true}]){Object.assign(update,state);assert.equal(await scheduler.tick(),false);}
 assert.equal(copies,2);
});
test('context lookup is part of the backup lease and excludes installer handoff',async()=>{
 const context=deferred(),updater=new EventEmitter();let installs=0,copies=0,scheduler;
 updater.quitAndInstall=()=>installs++;
 const update=new Updates({updater,canInstall:async()=>({allowed:!scheduler.running,reason:'Backup active'}),prepare:async()=>{}});
 scheduler=new BackupScheduler({update:()=>update,copy:async()=>{await context.promise;copies++;}});
 const backup=scheduler.tick();assert.equal(scheduler.running,true);assert.equal(await scheduler.tick(),false);
 updater.emit('update-downloaded',{version:'1.0.99'});await update.tick();assert.equal(installs,0);assert.equal(update.state.status,'ready');
 context.resolve();assert.equal(await backup,true);assert.equal(copies,1);await update.tick();assert.equal(installs,1);assert.equal(await scheduler.tick(),false);
});
test('failed context or storage work releases the lease and a closed window skips work',async()=>{
 let fail=true,closed=false,copies=0;const errors=[];
 const scheduler=new BackupScheduler({closed:()=>closed,copy:async()=>{if(fail)throw Error('offline');copies++;},error:e=>errors.push(e.message)});
 assert.equal(await scheduler.tick(),false);assert.equal(scheduler.running,false);assert.deepEqual(errors,['offline']);
 fail=false;assert.equal(await scheduler.tick(),true);closed=true;assert.equal(await scheduler.tick(),false);assert.equal(copies,1);
});
