const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {WarehouseUpdater,metadata,newer,runWarehouseInstaller}=require('../warehouse-updater.cjs');
const bytes=Buffer.alloc(1000000,42),hash=crypto.createHash('sha512').update(bytes).digest('base64'),url='https://github.com/ivankirillov414-art/fastgo-control/releases/download/fastgo-warehouse-v1.0.18/FastGo-Warehouse-Setup-1.0.18-Windows-x64.exe';
const feed=`version: 1.0.18\nfiles:\n  - url: ${url}\n    sha512: ${hash}\n    size: ${bytes.length}\n`;
test('companion accepts the official complete warehouse release and rejects another origin or downgrade',()=>{assert.equal(metadata(feed).version,'1.0.18');assert.throws(()=>metadata(feed.replace('github.com','example.org')));assert(newer('1.0.18','1.0.9'));assert(!newer('1.0.9','1.0.18'));assert(!newer('1.0.18','1.0.18'));});

test('the companion silent installer reopens the warehouse after an update',async()=>{
 const calls=[],installer='C:\\FastGo downloads\\FastGo-Warehouse-Setup-1.0.51-Windows-x64.exe';
 const result=await runWarehouseInstaller(installer,async(...args)=>{calls.push(args);return {stdout:'installed'};});
 assert.deepEqual(calls,[[installer,['/S','--updated','--force-run'],{windowsHide:true,timeout:180000}]]);
 assert.equal(result.stdout,'installed');
 await assert.rejects(runWarehouseInstaller(installer,async()=>{throw Error('Installer failed');}),/Installer failed/);
});
test('closed warehouse is upgraded and the installed package is read before success is reported',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-warehouse-update-'));let version='1.0.16',installs=0;const receipts=[];
 const updater=new WarehouseUpdater({dir,find:async()=>({folder:'fixture',version}),isRunning:async()=>false,read:()=>({version}),fetcher:async target=>new Response(target.includes('latest.yml')?feed:bytes),install:async file=>{assert(fs.readFileSync(file).equals(bytes));installs++;version='1.0.18';},report:async s=>receipts.push({...s})});
 try{await updater.tick();assert.equal(installs,1);assert.equal(updater.state.version,'1.0.18');assert.equal(updater.state.status,'current');assert.equal(receipts[0].status,'installing');await updater.tick();assert.equal(installs,1);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('running warehouse keeps its open documents and a corrupted download cannot run',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fg-warehouse-update-'));let active=true,bad=false,installs=0;
 const updater=new WarehouseUpdater({dir,find:async()=>({folder:'fixture',version:'1.0.16'}),isRunning:async()=>active,read:()=>({version:'1.0.18'}),fetcher:async target=>new Response(target.includes('latest.yml')?feed:bad?Buffer.alloc(bytes.length):bytes),install:async()=>installs++});
 try{await updater.tick();assert.equal(updater.state.status,'waiting_exit');assert.equal(installs,0);active=false;bad=true;fs.rmSync(dir,{recursive:true,force:true});await updater.tick();assert.equal(updater.state.status,'error');assert.equal(installs,0);assert.equal(fs.readdirSync(dir).length,0);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
