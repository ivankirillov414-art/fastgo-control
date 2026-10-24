const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {Store}=require('../store.cjs');
test('automatic backups preserve queued work, restore independently and reuse one quarter-hour slot',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-recovery-')),store=new Store(path.join(dir,'live.sqlite'));t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
 store.setting('printer','Fixture printer');store.localWrite('fixture','create',{first_name:'Test',last_name:'Fixture',phone:'000',brand:'Test',model:'Model',request_id:crypto.randomUUID()});
 const file=store.backup(),again=store.backup();assert.equal(file,again);store.setting('printer','Changed');
 const restored=new DatabaseSync(file,{readOnly:true});try{assert.equal(JSON.parse(restored.prepare("SELECT json FROM settings WHERE key='printer'").get().json),'Fixture printer');assert.equal(restored.prepare('SELECT count(*) AS n FROM outbox').get().n,1);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{restored.close();}
 const meta=JSON.parse(fs.readFileSync(file+'.json'));assert.equal(meta.sha256,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));assert.equal(meta.integrity,'ok');assert.equal(fs.readdirSync(path.dirname(file)).filter(x=>x.endsWith('.partial')).length,0);
});
