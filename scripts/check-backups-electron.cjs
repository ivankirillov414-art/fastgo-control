// Run with the built app's Electron binary in Node mode against its actual ASAR.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const asar=path.resolve(process.argv[2]||'desktop/dist/win-unpacked/resources/app.asar');
assert(fs.existsSync(asar),'Built ASAR required');
const common=fs.existsSync(path.join(asar,'store.cjs'));
const Store=common?require(path.join(asar,'store.cjs')).Store:null;
const {DatabaseSync}=require('node:sqlite');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fastgo-packaged-backup-'));
let store;
(async()=>{
 if(!common){
  const helper=require(path.join(asar,'backup-files.cjs')),file=path.join(dir,'warehouse-fixture.sqlite'),db=new DatabaseSync(file);
  try{for(const name of ['records','outbox','cache','settings','print_jobs'])db.exec('CREATE TABLE '+name+'(id INTEGER);INSERT INTO '+name+' VALUES(1)');}finally{db.close();}
  const verified=await helper.verifySQLite(file);assert.equal(verified.integrity,'ok');assert.equal(verified.rows.outbox,1);
  console.log(JSON.stringify({status:'PASS',runtime:process.versions,asar,scope:'standalone warehouse actual ASAR helper and unpacked verification worker',integrity:'ok',outbox:1,production_requests:0}));return;
 }
 store=new Store(path.join(dir,'live.sqlite'));
 store.localWrite('backup-fixture','create',{first_name:'Fixture',last_name:'Backup',phone:'000',brand:'Fixture',model:'Fixture',request_id:crypto.randomUUID()});
 const result=await store.backupDaily();assert.equal(result.status,'current',result.error);
 const entries=await store.dailyCatalog.list();assert.equal(entries.length,1);
 const file=path.join(store.dailyFolder,entries[0].sqlite.name),db=new DatabaseSync(file,{readOnly:true});
 try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare("SELECT count(*) n FROM outbox WHERE status='queued'").get().n,1);}finally{db.close();}
 console.log(JSON.stringify({status:'PASS',runtime:process.versions,asar,scope:'actual packaged Store, online SQLite copy, ASAR worker-thread verification and unsent queue restore',integrity:'ok',outbox:1,production_requests:0}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>{
 store?.close();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});
});
